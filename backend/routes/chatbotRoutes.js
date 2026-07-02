const express = require("express");
const { GoogleGenAI } = require("@google/genai");
require("dotenv").config();

const router = express.Router();

// Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// POST /api/chat
router.post("/", async (req, res) => {
     console.log("===== CHAT REQUEST RECEIVED =====");
  try {
    const { message, history, stress } = req.body;
    console.log("Message:", message);
    console.log("Stress:", stress);
    console.log("History:", history);

    // Stress-specific instruction
    let stressInstruction = "";

    if (stress === "high") {
      stressInstruction =
        "The student appears highly stressed. Respond with empathy, emotional support, and 2 simple coping strategies.";
    } else if (stress === "medium") {
      stressInstruction =
        "The student appears moderately stressed. Encourage healthy habits and ask gentle follow-up questions.";
    } else {
      stressInstruction =
        "The student appears generally okay. Keep the conversation friendly and supportive.";
    }

    // Convert React history into plain text
    const conversation = history
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const prompt = `
You are MindTrace AI.

You are NOT a generic chatbot.

You are a friendly student wellness companion inside the MindTrace Burnout Prediction Dashboard.

Rules:

1. If this is the student's first message, greet them warmly by name if possible.

2. Never reply with only:
"I'm here—can you tell me more?"

3. Always acknowledge what the student said first.

4. Then respond according to the stress level.

5. HIGH stress:
- show empathy
- reassure them
- give two practical suggestions
- end with one gentle follow-up question

6. MEDIUM stress:
- encourage them
- suggest one healthy habit
- ask one follow-up question

7. LOW stress:
- be cheerful
- motivate them
- continue the conversation naturally

8. Keep responses under 120 words.

Current detected stress:
${stress}

Instruction:
${stressInstruction}

Conversation history:
${conversation}

Student says:
${message}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    console.log("Gemini Reply:");
    console.log(response.text);

    res.json({
      success: true,
      reply: response.text,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      reply:
        "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
    });
  }
});

module.exports = router;