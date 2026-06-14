import readline from 'readline';

// Preserved API Key from file
const ;

const MODEL = "gemini-2.5-flash";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const systemInstruction = {
  parts: [
    {
      text: "You are a helpful assistant. You support English, Tamil (தமிழ்), and Sinhala (සිංහල). Respond in the language requested by the user. If they speak in Tamil, respond in Tamil. If they speak in Sinhala, respond in Sinhala."
    }
  ]
};

const chatHistory = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("==========================================================");
console.log("🌟 Velora AI / Gemini Console Chat Client");
console.log(`🤖 Model: ${MODEL}`);
console.log("🌐 Languages: Tamil (தமிழ்) | Sinhala (සිංහල) | English");
console.log("Commands: type 'exit' or 'quit' to close the chat.");
console.log("==========================================================\n");

async function askQuestion() {
  rl.question("\x1b[36mYou: \x1b[0m", async (input) => {
    const trimmedInput = input.trim();
    if (trimmedInput.toLowerCase() === "exit" || trimmedInput.toLowerCase() === "quit") {
      console.log("\n👋 Exiting console chat. Goodbye!");
      rl.close();
      return;
    }

    if (!trimmedInput) {
      askQuestion();
      return;
    }

    // Append user message to history
    chatHistory.push({
      role: "user",
      parts: [{ text: trimmedInput }]
    });

    process.stdout.write("\x1b[35mGemini: \x1b[0mThinking...");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: chatHistory,
          systemInstruction: systemInstruction
        })
      });

      // Clear the "Thinking..." text
      process.stdout.write("\r\x1b[35mGemini: \x1b[0m");

      if (!response.ok) {
        const errText = await response.text();
        console.log(`\x1b[31mError: API responded with status ${response.status}\nDetails: ${errText}\x1b[0m\n`);
        // Remove last user message since it failed to get a response
        chatHistory.pop();
        askQuestion();
        return;
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response text found.";
      
      console.log(reply + "\n");

      // Append model response to history
      chatHistory.push({
        role: "model",
        parts: [{ text: reply }]
      });

    } catch (err) {
      process.stdout.write("\r\x1b[35mGemini: \x1b[0m");
      console.log(`\x1b[31mError: Connection failed. ${err.message}\x1b[0m\n`);
      chatHistory.pop();
    }

    askQuestion();
  });
}

askQuestion();