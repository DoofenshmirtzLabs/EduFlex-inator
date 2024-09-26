import { YoutubeTranscript } from 'youtube-transcript';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DataAPIClient } from "@datastax/astra-db-ts";
import dotenv from 'dotenv';
import {transcript} from './tools/temp.js';
dotenv.config();


// Initialize database client

const GEMINI_KEY="AIzaSyD_3qToMzCq4G6vnzO0NGbNq6q-oJPrFDQ"
const YOUTUBE_API_KEY ="AIzaSyAalKwhBlFVNN7xCIT4tCGFVNwETZhFaPM"
const ASTRA_DB_KEY='AstraCS:hsFlqHXfDHawTjvRQuygUEYg:f2c4f48e762db3b69c5292780534e6c3d4f8e1ecdb2de603d891d60bb1e26cae'

const client = new DataAPIClient(ASTRA_DB_KEY);

const db = client.db('https://a57f3393-b503-4271-bd75-a6bf73fdb692-us-east1.apps.astra.datastax.com');
let currenttopicname=null;
(async () => {
  const colls = await db.listCollections();
  console.log('Connected to AstraDB:', colls);
})();
const collection = db.collection('semantic_v2');

const app = express();
const port = 5000;

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Body parser to parse JSON requests

let conversationHistory = [];


// Replace with your actual API key
const apiKey = GEMINI_KEY;
async function semanticsearch(userinput) {
  console.log("User input for search:", userinput);
  const cursor = await collection.find({}, {
    sort: { $vectorize: userinput },
    limit: 1,
    includeSimilarity: true,
  });

  const results = await cursor.toArray(); // Get the matching documents as an array
  return results
}
async function fetchtopicname(videoId) {
  console.log("videoid:",videoId)
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet`;

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`YouTube API request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.items && data.items.length > 0) {
      const videoTitle = data.items[0].snippet.title;
      console.log(videoTitle)
      return videoTitle;
    } else {
      throw new Error('No video found with the given ID');
    }

  } catch (error) {
    console.error('Error fetching video title:', error);
    throw error;
  }
  
}


async function generateContent(prompt, context) {
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const updatedPrompt = `${context}\n${prompt}`;
    const result = await model.generateContent(updatedPrompt);

    conversationHistory.push({ user: prompt, system: result.response.text() });
    return result.response.text();
  } catch (error) {
    console.error('Error generating content:', error);
    throw new Error('Content generation failed');
  }
}

async function fetchEnglishTranscript(videoId) {
  console.log("fetch transcript for videoid:",videoId)
  try {
    const allTranscripts = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: 'en',
    });

    if (!allTranscripts || allTranscripts.length === 0) {
      console.log('No English transcript found for this video.');
      return;
    }
    console.log("fetched transcript:",allTranscripts)
    const combinedTranscript = allTranscripts.map(entry => entry.text).join(' ');
    
    return combinedTranscript

  } catch (error) {
    console.error('Error fetching English transcript:', error);
    throw new Error('Transcript fetching failed');
  }
}

async function generateMCQTest(videoId, numQuestions, difficultyLevel) {

  const genAI = new GoogleGenerativeAI(apiKey);
  currenttopicname=fetchtopicname(videoId)
  console.log(currenttopicname)
  const prompt = `
    Create an MCQ test based on the following specifications:
    - Topic: ${currenttopicname}
    - Number of questions: ${numQuestions}
    - Difficulty level: ${difficultyLevel} (easy, medium, hard)

    For each question, provide the following format:
    {
      "question": {
        "id": "q1",
        "text": "Your question text here",
        "options": [
          { "id": "o1", "text": "Option 1" },
          { "id": "o2", "text": "Option 2" },
          { "id": "o3", "text": "Option 3" },
          { "id": "o4", "text": "Option 4" }
        ],
        "answer": {
          "optionId": "correct_option_id",
          "text": "Correct answer text"
        }
      }
    }
  `;

  try {
    const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    
    let responseText = result.response.text().trim();
    responseText = responseText.replace(/```json|```/g, "").trim();
    
    const generatedResponse = JSON.parse(responseText);
    console.log("generatedresponse:",generatedResponse)
    return generatedResponse;
  } catch (error) {
    console.error("Error generating MCQ test:", error);
    throw new Error('MCQ generation failed');
  }
}

async function transcripttocontext(videoId) {
  try {
    const transcript = await fetchEnglishTranscript(videoId); // Await the transcript function
    if (transcript) {
      console.log("transcript available adding to history")
      conversationHistory.push({ user: `Transcript for video ${videoId}`, system: transcript });
      console.log("history after transcript:",conversationHistory)
    }
  } catch (error) {
    console.error("Error in transcripttocontext:", error);
  }
}
app.post('/transcripttocontext', async (req, res) => {
  const { videoId } = req.body;
  try {
    await transcripttocontext(videoId); // Await the transcript function
    res.status(200).send({ message: "Transcript added to context." }); // Send a success response
  } catch (error) {
    console.log("Got an error while adding transcript to context:", error);
    res.status(500).send({ error: "Failed to add transcript to context." }); // Send an error response
  }
});



// Endpoint to generate MCQ test
app.post('/generate-mcq', async (req, res) => {
  const { videoId, numQuestions, difficultyLevel } = req.body;

  try {
    console.log("video id in server:",videoId)
    const mcqTest = await generateMCQTest(videoId, numQuestions, difficultyLevel);
    res.json(mcqTest);
  } catch (error) {
    console.error("MCQ Generation Error:", error);
    res.status(500).json({ error: 'Failed to generate MCQ test', details: error.message });
  }
});

// Endpoint to start a conversation

app.post('/start-conversation', async (req, res) => {

  const { userPrompt, videoId } = req.body;

  if (!userPrompt || !videoId) {
    return res.status(400).json({ error: 'userPrompt and videoId are required' });
  }

  // Update the userPrompt to include the YouTube link
  const data=await transcript(videoId)
  const updatedPrompt = `${userPrompt} this is the YouTube video that I want to talk about: ${data}`;

  
  
  const context = conversationHistory.map(entry => `${entry.user}: ${entry.system}`).join('\n');
  console.log("context:",context)
  console.log("chathistory:",conversationHistory)

  try {
    const response = await generateContent(updatedPrompt, context);
    res.json({ response });
  } catch (error) {
    console.error('Conversation Error:', error);
    res.status(500).json({ error: 'Failed to generate response', details: error.message });
  }
});

// Endpoint for semantic search
app.post('/semantic-search', async (req, res) => {
  const { userinput } = req.body;
  console.log("User input:", userinput);

  try {
    const results = await semanticsearch(userinput);

    let redirectUrl; // Variable to store the URL

    if (results.length === 0) {
      // No relevant URLs found
      redirectUrl = null; // Indicate no URL found
    } else {
      // Extract the URL from the first element (assuming the best match)
      console.log("result[0",results[0])
      console.log("result_url:",results[0].url)
      redirectUrl = results[0].url;
    }

    res.json({ url: redirectUrl }); // Send only the extracted URL
    return res;
  } catch (error) {
    console.error("Semantic Search Error:", error);
    res.status(500).json({ error: 'Failed to perform semantic search', details: error.message });
    return ;
  }
})
// Endpoint to fetch English transcript
app.post('/fetchEnglishTranscript', async (req, res) => {
  console.log("recevied an request to fetch transcript")
  const { videoId } = req.body;

  try {
    const transcript = await fetchEnglishTranscript(videoId);
    res.json(transcript);
    return res
  } catch (error) {
    console.error('Transcript Fetching Error:', error);
    res.status(500).json({ error: 'Failed to fetch transcript', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
