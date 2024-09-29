const jsonResponse = ```json
{
  "tool": 2,
  "input": {
    "topic": "Machine Learning",
    "num_questions": 5,
    "difficulty": "medium"
  }
}
```;
  
  // Parse the JSON string
  const response = JSON.parse(jsonResponse);
  
  // Print the data
  console.log(`Tool: ${response.tool}`);
  console.log(`Topic: ${response.input.topic}`);
  console.log(`Number of Questions: ${response.input.num_questions}`);
  console.log(`Difficulty: ${response.input.difficulty}`);