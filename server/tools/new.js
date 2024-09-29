import { GoogleGenerativeAI } from "@google/generative-ai";

 async function decideToolWithGemini(userInput, apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
      const model = await genAI.getGenerativeModel({ model: 'gemini-1.5-flash', temperature: 0 });
      
      const context = `
        You are a tool manager that decides which tool to use based on the user's input: ${userInput}.
        Select one of the following tools:
          Tool 1: Semantic search (requires a topic name as input).
          Tool 2: Create a custom exam (requires a topic name, number of questions, and difficulty level - 'easy', 'medium', 'hard').
        Return a valid JSON response with two fields: 'tool' and 'input'.(very important: dont not include any tick symbols or json word inside text feild in response)
        Example response:
        {
          "tool": 2,
          "input": {
            "topic": "Quantum Physics",
            "num_questions": 10,
            "difficulty": "medium"
          }
        }
      `;
      
      const result = await model.generateContent(context);
      
      // Parse the JSON response directly
      const parsedResult = JSON.parse(result.response.text()); // Ensure this is clean JSON
      
      // Output the tool decision and processed input
      console.log('Selected Tool:', parsedResult.tool);
      console.log('Processed Input:', JSON.stringify(parsedResult.input, null, 2)); // Pretty print input without backticks
      
      return parsedResult;
    } catch (error) {
      console.error('Error generating content:', error);
      throw new Error('Content generation failed');
    }
  }
  
  // Example usage
 
 
  