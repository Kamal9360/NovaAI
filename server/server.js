
import express from "express";
import cors from "cors";

const app = express();
const PORT = 5000;
const MODEL = "qwen2.5:1.5b";

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "30kb" }));

app.get("/", (req, res) => {
  res.json({ message: "NovaAI local AI backend is running!" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;

    if (
      !Array.isArray(messages) ||
      messages.length === 0 ||
      messages.length > 30
    ) {
      return res.status(400).json({
        error: "Please provide a valid conversation.",
      });
    }

    const valid = messages.every(
      (m) =>
        m &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string" &&
        m.content.trim().length > 0 &&
        m.content.length <= 10000
    );

    if (
      !valid ||
      messages[messages.length - 1].role !== "user"
    ) {
      return res.status(400).json({
        error: "Invalid conversation.",
      });
    }

    const response = await fetch(
      "http://localhost:11434/api/chat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are NovaAI, a friendly and helpful AI assistant. " +
                "Explain answers clearly and use examples when helpful.",
            },
            ...messages,
          ],
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      console.error("Ollama error:", await response.text());
      return res.status(502).json({
        error: "Ollama failed. Check that the model is installed.",
      });
    }

    const data = await response.json();
    res.json({ reply: data.message?.content || "No response received." });
  } catch (error) {
    console.error("NovaAI error:", error.message);
    res.status(500).json({
      error: "Could not connect to local AI. Check that Ollama is running.",
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    const response = await fetch(
      "http://localhost:11434/api/tags"
    );

    if (!response.ok) {
      return res.status(503).json({
        status: "disconnected",
        message: "Ollama is unavailable",
      });
    }

    res.json({
      status: "connected",
      message: "Backend and Ollama are available",
    });
  } catch (error) {
    res.status(503).json({
      status: "disconnected",
      message: "Cannot connect to Ollama",
    });
  }
});

app.listen(PORT, () => {
  console.log(`NovaAI backend running at http://localhost:${PORT}`);
});
