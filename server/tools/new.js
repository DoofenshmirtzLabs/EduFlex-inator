function manualParseJSON(jsonString) {
  // Trim whitespace and check if it's an array
  jsonString = jsonString.trim();

  // If it's an array
  if (jsonString.startsWith('[')) {
      return parseArray(jsonString);
  } else {
      // If it's a single object
      return parseObject(jsonString);
  }
}

function parseArray(arrayString) {
  const array = [];
  // Remove the surrounding brackets and split by '},'
  const trimmed = arrayString.slice(1, -1).trim();
  const items = splitItems(trimmed);

  items.forEach(item => {
      const parsedItem = parseObject(item);
      array.push(parsedItem);
  });

  return array;
}

function splitItems(string) {
  const items = [];
  let openBraces = 0;
  let currentItem = '';

  for (let i = 0; i < string.length; i++) {
      const char = string[i];
      currentItem += char;

      if (char === '{') openBraces++;
      if (char === '}') openBraces--;

      if (openBraces === 0 && (i + 1 < string.length && string[i + 1] === ',' || i + 1 === string.length)) {
          items.push(currentItem);
          currentItem = '';
      }
  }
  return items.map(item => item.trim());
}

function parseObject(objectString) {
  const obj = {};
  // Remove surrounding braces and whitespace
  const trimmed = objectString.slice(1, -1).trim();
  
  // Split key-value pairs based on commas, handling nested braces
  const pairs = splitPairs(trimmed);

  pairs.forEach(pair => {
      const [key, value] = pair.split(':').map(item => item.trim());
      const cleanedKey = key.replace(/"/g, ''); // Remove quotes from key

      // Handle nested objects and arrays in options
      if (cleanedKey === "options") {
          obj[cleanedKey] = parseOptions(value);
      } else if (cleanedKey === "answer") {
          obj[cleanedKey] = parseAnswer(value);
      } else {
          obj[cleanedKey] = value.replace(/"/g, ''); // Remove quotes from value
      }
  });

  return obj;
}

function splitPairs(string) {
  const pairs = [];
  let openBraces = 0;
  let currentPair = '';

  for (let i = 0; i < string.length; i++) {
      const char = string[i];
      currentPair += char;

      if (char === '{') openBraces++;
      if (char === '}') openBraces--;

      // A comma indicates the end of a key-value pair if not within braces
      if (char === ',' && openBraces === 0) {
          pairs.push(currentPair.slice(0, -1).trim()); // Remove the last comma
          currentPair = '';
      }
  }
  // Push the last pair
  if (currentPair) {
      pairs.push(currentPair.trim());
  }

  return pairs;
}

function parseOptions(optionsString) {
  const optionsArray = [];
  // Remove surrounding brackets and split into individual options
  const trimmed = optionsString.slice(1, -1).trim();
  const items = splitItems(trimmed);

  items.forEach(opt => {
      const optionObj = parseObject(opt);
      optionsArray.push(optionObj);
  });

  return optionsArray;
}

function parseAnswer(answerString) {
  return parseObject(answerString);
}

// Example usage
const correctResponse = `{
  "question": {
    "id": "q1",
    "text": "What is the fundamental principle of quantum superposition?",
    "options": [
      { "id": "o1", "text": "A particle can exist in multiple states simultaneously." },
      { "id": "o2", "text": "Particles can only exist in one state at a time." }
    ],
    "answer": {
      "optionId": "o1",
      "text": "A particle can exist in multiple states simultaneously."
    }
  }
}`;

const wrongResponse = `[ 
  { "question": { "id": "q1", "text": "What is the fundamental principle of quantum superposition?", "options": [ { "id": "o1", "text": "A particle can exist in multiple states simultaneously." }, { "id": "o2", "text": "Particles can only exist in one state at a time." } ], "answer": { "optionId": "o1", "text": "A particle can exist in multiple states simultaneously." } } },
  { "question": { "id": "q2", "text": "What is the Heisenberg Uncertainty Principle?", "options": [ { "id": "o1", "text": "It states that the position and momentum of a particle cannot be known with absolute certainty." } ], "answer": { "optionId": "o1", "text": "It states that the position and momentum of a particle cannot be known with absolute certainty." } } }
]`;

console.log("Parsed Correct Response:", manualParseJSON(correctResponse));
console.log("Parsed Wrong Response:", manualParseJSON(wrongResponse));
