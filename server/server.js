import { YoutubeTranscript } from 'youtube-transcript';
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DataAPIClient } from "@datastax/astra-db-ts";
import dotenv from 'dotenv';
import {transcript} from './tools/temp.js';
import mongoose from "mongoose";
import { router as authRoutes } from "./routes/auth.js";
import { authenticate } from "./middleware/auth.js";
import { coursesData } from './tools/topics.js';

dotenv.config();
console.log(process.env.MONGO_URI)
 // Ensure MONGO_URI is being loaded

if (!mongoURI) {
  console.error("MongoDB connection string is missing");
  process.exit(1); // Exit the application if no MongoDB URI is provided
}

mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));





// Initialize database client



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
app.use("/auth",authRoutes);


// Static Files (your existing front-end files)
app.use(express.static('public'));
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
async function decideToolWithGemini(userInput, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
    const model = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash', temperature: 0 });
    
    const context = `
   You are a tool manager that selects a tool based on the user's input: ${userInput}.
Choose one of the following tools:
  Tool 1: Semantic search(use if users is searching for a topic or an course) (requires a topic name as input).
  Tool 2: Create a custom exam (use it if user is asking to create an custom exam)(requires a topic name, number of questions, and difficulty level - 'easy', 'medium', 'hard').
  Tool 3: Update user profile (use when the user wants to update their profile) (requires  email, and password).

To select Tool 3, ensure that all three fields ( email, password) are provided. If only two fields are supplied, return null for the input field.
  Return a valid JSON response. The response **must** only contain two fields: 'tool' and 'input'. 

The format should strictly follow this structure:
{
  "tool": 2,
  "input": {
    "topic": "Quantum Physics",
    "num_questions": 10,
    "difficulty": "medium"
  }
}

Do not include any additional text or comments. The response should only contain valid JSON as shown above. 

    `;

    console.log("Context:", context);
    
    const result = await model.generateContent(context);

    // Ensure the response is awaited properly
    const responseText = await result.response.text();
    console.log("Raw response text:", responseText);

    // Parse the response to JSON
    const parsedResult = JSON.parse(responseText);
    console.log("Parsed result:", parsedResult);

    // Output the tool decision and processed input
    console.log('Selected Tool:', parsedResult.tool);
    console.log('Processed Input:', JSON.stringify(parsedResult.input, null, 2));

    return parsedResult;
  } catch (error) {
    console.error('Error generating content:', error);
    throw new Error('Content generation failed');
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
//for video exams
async function generateMCQTest(videoId, numQuestions, difficultyLevel) {

  const genAI = new GoogleGenerativeAI(apiKey);
  currenttopicname=await transcript(videoId);
  console.log("current topic name in server",currenttopicname)
  const prompt = `
  You are generating a multiple-choice test based on the following specifications:
  - Topic: ${currenttopicname}
  - Number of questions: ${numQuestions}
  - Difficulty level: ${difficultyLevel} (easy, medium, hard)
  Important:
  1. Ensure the response is a valid JSON array containing multiple questions.
  2. The response format must strictly follow this example structure:
  [
  {
    "question": {
      "id": "q1",
      "text": "What is AI?",
      "options": [
        { "id": "o1", "text": "Artificial Intelligence" },
        { "id": "o2", "text": "Automated Input" },
        { "id": "o3", "text": "Algorithm Interaction" },
        { "id": "o4", "text": "Automated Integration" }
      ],
      "answer": {
        "optionId": "o1",
        "text": "Artificial Intelligence"
      }
    }
  },
  {
    "question": {
      "id": "q2",
      "text": "How does AI learn?",
      "options": [
        { "id": "o1", "text": "By inputting rules" },
        { "id": "o2", "text": "Through machine learning" },
        { "id": "o3", "text": "With manual updates" },
        { "id": "o4", "text": "By random guessing" }
      ],
      "answer": {
        "optionId": "o2",
        "text": "Through machine learning"
      }
    }
  }
]
  3. Do not include any additional text, comments, or explanations.
  4. The response should contain exactly ${numQuestions} questions.
  `;

  try {
    const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log(prompt)
    const result = await model.generateContent(prompt);
    console.log("result",result)
    let responseText = result.response.text().trim();
    console.log("result",responseText)
    responseText = responseText.replace(/```json|```/g, "").trim();
    
    const generatedResponse = JSON.parse(responseText);
    console.log("generatedresponse:",generatedResponse)
    return generatedResponse;
  } catch (error) {
    console.error("Error generating MCQ test:", error);
    throw new Error('MCQ generation failed');
  }
}
//final exam mcq generration function
async function generateMCQTestwithtopics(topics, numQuestions, difficultyLevel) {
  const genAI = new GoogleGenerativeAI(apiKey);
  
  console.log("Current topic name in server:", topics);
  const prompt = `
  You are generating a multiple-choice test based on the following specifications:
  - Topic: ${topics}
  - Number of questions: ${numQuestions}
  - Difficulty level: ${difficultyLevel} (easy, medium, hard)
  Important:
  1. Ensure the response is a valid JSON array containing multiple questions.
  2. The response format must strictly follow this example structure:
  [
  {
    "question": {
      "id": "q1",
      "text": "What is AI?",
      "options": [
        { "id": "o1", "text": "Artificial Intelligence" },
        { "id": "o2", "text": "Automated Input" },
        { "id": "o3", "text": "Algorithm Interaction" },
        { "id": "o4", "text": "Automated Integration" }
      ],
      "answer": {
        "optionId": "o1",
        "text": "Artificial Intelligence"
      }
    }
  },
  {
    "question": {
      "id": "q2",
      "text": "How does AI learn?",
      "options": [
        { "id": "o1", "text": "By inputting rules" },
        { "id": "o2", "text": "Through machine learning" },
        { "id": "o3", "text": "With manual updates" },
        { "id": "o4", "text": "By random guessing" }
      ],
      "answer": {
        "optionId": "o2",
        "text": "Through machine learning"
      }
    }
  }
]
  3. Do not include any additional text, comments, or explanations.
  4. The response should contain exactly ${numQuestions} questions.
  `;
  

  try {
    const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Generated Prompt:", prompt);
    
    const result = await model.generateContent(prompt);
    console.log("Raw Result:", result);
    
    let responseText = result.response.text().trim();
    responseText = responseText.replace(/```json|```/g, "").trim();

    try {
      const generatedResponse = JSON.parse(responseText);
      console.log("Generated Response:", JSON.stringify(generatedResponse, null, 2));
      return generatedResponse;
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError);
      throw new Error('Invalid JSON response from MCQ generation');
    }
    
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


//for custom exams
async function generatecustomMCQTest(toolInputs){
  const genAI = new GoogleGenerativeAI(apiKey);

  console.log("tool inputs",toolInputs)
  const parsedInputs = JSON.parse(toolInputs);
  const topics = parsedInputs.topic;          // "Machine Learning"
  const numQuestions = parsedInputs.num_questions; // 10
  const difficultyLevel = parsedInputs.difficulty; // "medium"

// Logging the extracted values


console.log("Difficulty Level:", difficultyLevel);
 
  
 const prompt = `
  You are generating a multiple-choice test based on the following specifications:
  - Topic: ${topics}
  - Number of questions: ${numQuestions}
  - Difficulty level: ${difficultyLevel} (easy, medium, hard)
  Important:
  1. Ensure the response is a valid JSON array containing multiple questions.
  2. The response format must strictly follow this example structure:
  [
  {
    "question": {
      "id": "q1",
      "text": "What is AI?",
      "options": [
        { "id": "o1", "text": "Artificial Intelligence" },
        { "id": "o2", "text": "Automated Input" },
        { "id": "o3", "text": "Algorithm Interaction" },
        { "id": "o4", "text": "Automated Integration" }
      ],
      "answer": {
        "optionId": "o1",
        "text": "Artificial Intelligence"
      }
    }
  },
  {
    "question": {
      "id": "q2",
      "text": "How does AI learn?",
      "options": [
        { "id": "o1", "text": "By inputting rules" },
        { "id": "o2", "text": "Through machine learning" },
        { "id": "o3", "text": "With manual updates" },
        { "id": "o4", "text": "By random guessing" }
      ],
      "answer": {
        "optionId": "o2",
        "text": "Through machine learning"
      }
    }
  }
]
  3. Do not include any additional text, comments, or explanations.
  4. The response should contain exactly ${numQuestions} questions.
  `
  try {
    const model = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    

    const result = await model.generateContent(prompt);
    
    let responseText = result.response.text().trim();
    responseText = responseText.replace(/```json|```/g, "").trim();
    console.log("trimed response",responseText)
    
      const generatedResponse = JSON.parse(responseText);
   
    return generatedResponse;
      
   
  } catch (error) {
    console.error("Error generating MCQ test:", error);
    throw new Error('MCQ generation failed');
  }


}

async function gettopics(coursename){
  console.log(coursename)
  console.log("trying to get courseDATA")
  return coursesData[coursename] ? coursesData[coursename].topics : [];
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
app.post('/agent', async (req, res) => {
  const { userInput } = req.body;
  console.log("user input in server:", userInput);

  try {
    // Call your decideToolWithGemini function
    const toolDecision = await decideToolWithGemini(userInput, apiKey);
    
    // If toolDecision is undefined or null, handle it as an error
    if (!toolDecision) {
      throw new Error("No tool decision returned.");
    }

    console.log("result in agent:", toolDecision);

    // Send the result back to the client as JSON
    return res.json(toolDecision);  // Use res.json() to send JSON response
  } catch (error) {
    console.log("Error deciding the tool usage:", error);
    
    // Return a 500 error with a message to the client
    return res.status(500).json({ error: "An error occurred while deciding the tool." });
  }
});
app.post('/generate-custom-mcq',async(req,res)=>{
  const{toolInputs}=req.body;
  try {
    
    const mcqTest = await generatecustomMCQTest(toolInputs);
    res.json(mcqTest);
  } catch (error) {
    console.error("MCQ Generation Error:", error);
    res.status(500).json({ error: 'Failed to generate MCQ test', details: error.message });
  }

})

app.post('/generate-mcq-finalexam', async (req, res) => {
  const { topics, numQuestions, difficultyLevel } = req.body;
  console.log("topics",topics);

  try {
    // Logging the input values to verify the request data
    console.log("Topics in server:", topics);
    console.log("Number of Questions:", numQuestions);
    console.log("Difficulty Level:", difficultyLevel);

    // Ensure all required fields are provided
    if (!topics || !numQuestions || !difficultyLevel) {
      return res.status(400).json({ error: "Missing required fields: topics, numQuestions, or difficultyLevel." });
    }

    // Assuming generateMCQTestwithtopics is a valid function that returns an MCQ test based on inputs
    const mcqTest = await generateMCQTestwithtopics(topics, numQuestions, difficultyLevel);
    

    res.json(mcqTest);
  } catch (error) {
    try{const mcqTest = await generateMCQTestwithtopics(topics, numQuestions, difficultyLevel);
    
    // Return the generated MCQ test
    console.log("there was an error generating again")
    res.json(mcqTest)}
    catch(error){
      res.status(500).json({ error: "Failed to generate MCQ test", details: error.message });
    }

    // Send an error response with the error message
   
  }
});
// Endpoint to start a conversation

let conversationStarted = false; // Track whether the conversation has started

app.post('/start-conversation', async (req, res) => {
  const { userPrompt, videoId } = req.body;

  if (!userPrompt || !videoId) {
    return res.status(400).json({ error: 'userPrompt and videoId are required' });
  }

  // Fetch the transcript from the YouTube video
  const data = await transcript(videoId);
  let updatedPrompt;

  // Include transcript only in the first conversation
  if (!conversationStarted) {
    updatedPrompt = `${userPrompt} this is the YouTube video that I want to talk about: ${data}`;
    console.log("updated prompt",updatedPrompt)
    conversationStarted = true; // Set the flag to true after the first conversation
  } else {
    updatedPrompt = `${userPrompt}`;
  }

  const context = conversationHistory.map(entry => `${entry.user}: ${entry.system}`).join('\n');
  console.log("context:", context);
  console.log("chat history:", conversationHistory);

  try {
    const response = await generateContent(updatedPrompt, context);
    // Optionally, store the latest conversation in the history
    conversationHistory.push({ user: userPrompt, system: response });

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
app.post('/get-topics',async(req,res)=>{

  const {courseName}=req.body
  console.log("called get topics",courseName)
  try{
    const topics= await gettopics(courseName);
    console.log("topics in get-topics server:",topics)
    res.json(topics)
  }

catch(error){
  console.log("error fetching the topics:",error)
}
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
