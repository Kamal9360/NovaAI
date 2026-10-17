
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();

const PORT = process.env.PORT || 5000;
const MODEL = process.env.OLLAMA_MODEL || "qwen2.5:1.5b";

const OLLAMA_BASE_URL = (
  process.env.OLLAMA_BASE_URL || "http://localhost:11434"
).replace(/\/+$/, "");

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header, such as local health checks.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
  })
);

app.use(express.json({ limit: "30kb" }));

app.get("/", (req, res) => {
  res.json({ message: "NovaAI backend is running!" });
});

app.get("/api/health", async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

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
  } catch {
    res.status(503).json({
      status: "disconnected",
      message: "Cannot connect to Ollama",
    });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body ?? {};

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
      (message) =>
        message &&
        ["user", "assistant"].includes(message.role) &&
        typeof message.content === "string" &&
        message.content.trim().length > 0 &&
        message.content.length <= 10000
    );

    if (!valid || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({
        error: "Invalid conversation.",
      });
    }

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
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
    });

    if (!response.ok) {
      console.error("Ollama error:", await response.text());

      return res.status(502).json({
        error: "The AI service returned an error.",
      });
    }

    const data = await response.json();

    res.json({
      reply: data.message?.content || "No response received.",
    });
  } catch (error) {
    console.error("NovaAI error:", error.message);

    res.status(502).json({
      error: "Could not connect to the AI service.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`NovaAI backend listening on port ${PORT}`);
});
