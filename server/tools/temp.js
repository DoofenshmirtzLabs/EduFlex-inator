let videoTranscript = null;

export async function transcript(videoId) {
  try {
    videoTranscript = await fetch('http://localhost:5000/fetchEnglishTranscript', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId: videoId }),
    });

    // Check if the response is okay
    if (!videoTranscript.ok) {
      throw new Error('Network response was not ok');
    }

    // Parse the response as JSON
    const data = await videoTranscript.json();
    
    // Print the combined transcript received from the server
    console.log("Combined Transcript:", data); 
    return data;// Assuming the server sends the transcript as a JSON response

  } catch (error) {
    console.log("Error while adding transcript to chatbot", error);
    return ;
  }
}

// Call the function with the desired video ID
        async function transcripttochatbot(videoId) {
  try {
   await fetch('http://localhost:5000/transcripttocontext', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoId: videoId }),
    });

}catch(error){
    console.log("error while adding context to chatbot",error)
}
        }
