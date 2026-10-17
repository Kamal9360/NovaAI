import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { useState, useRef, useEffect } from "react";
import "./App.css";

const suggestions = [
  {
    icon: "✦",
    title: "Explain something",
    prompt: "Explain artificial intelligence in simple words.",
  },
  {
    icon: "⌘",
    title: "Write some code",
    prompt: "Show me a simple React component with an explanation.",
  },
  {
    icon: "✎",
    title: "Help me write",
    prompt: "Write a professional email requesting an internship.",
  },
  {
    icon: "◎",
    title: "Learn something new",
    prompt: "Give me five interesting facts about space.",
  },
];

function App() {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
const [speakingMessage, setSpeakingMessage] = useState(null);

const speakMessage = (text, messageId) => {
  if (!("speechSynthesis" in window)) {
    alert("Speech is not supported in this browser.");
    return;
  }

  if (speakingMessage === messageId) {
    window.speechSynthesis.cancel();
    setSpeakingMessage(null);
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1;
  utterance.pitch = 1;

  utterance.onend = () => setSpeakingMessage(null);
  utterance.onerror = () => setSpeakingMessage(null);

  setSpeakingMessage(messageId);
  window.speechSynthesis.speak(utterance);
};

const startVoiceInput = () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert("Voice input is not supported in this browser. Try Chrome or Edge.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => setIsListening(true);

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;

    setInput((previous) =>
      previous ? `${previous} ${transcript}` : transcript
    );
  };

  recognition.onerror = () => {
    setIsListening(false);
  };

  recognition.onend = () => {
    setIsListening(false);
  };

  recognition.start();
};
  const [chats, setChats] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("novaai-chats") || "[]");
    } catch {
      return [];
    }
  });
const [searchQuery, setSearchQuery] = useState("");
const filteredChats = chats.filter((chat) => {
  const query = searchQuery.toLowerCase().trim();

  if (!query) return true;

  const titleMatches = (chat.title || "")
    .toLowerCase()
    .includes(query);

  const messageMatches = (chat.messages || []).some((message) =>
    (message.content || message.text || "")
      .toLowerCase()
      .includes(query)
  );

  return titleMatches || messageMatches;
});
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("novaai-theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const [activeChat, setActiveChat] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copied, setCopied] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, error]);

  useEffect(() => {
    try {
      localStorage.setItem("novaai-chats", JSON.stringify(chats));
    } catch (err) {
      console.error("Unable to save chat history:", err);
    }
  }, [chats]);

  useEffect(() => {
    try {
      localStorage.setItem("novaai-theme", theme);
    } catch (err) {
      console.error("Unable to save theme preference:", err);
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  function newChat() {
    if (loading) return;

    setMessages([]);
    setInput("");
    setActiveChat(null);
    setError("");
    inputRef.current?.focus();
  }

  async function sendMessage(text = input) {
    const question = text.trim();

    if (!question || loading) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    const conversation = [...messages, userMessage];
    const chatId = activeChat ?? Date.now();

    setMessages(conversation);
    setActiveChat(chatId);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to get a response from NovaAI."
        );
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("NovaAI returned an empty response. Please try again.");
      }

      const updated = [
        ...conversation,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: data.reply,
        },
      ];

      setMessages(updated);

      setChats((previous) => {
        const chat = {
          id: chatId,
          title: question.slice(0, 30),
          messages: updated,
        };

        const exists = previous.some((item) => item.id === chatId);

        return exists
          ? previous.map((item) => (item.id === chatId ? chat : item))
          : [chat, ...previous];
      });
    } catch (err) {
      console.error("NovaAI chat error:", err);

      setError(
        err.message || "Unable to connect to NovaAI. Please check your backend."
      );

      setChats((previous) => {
        const chat = {
          id: chatId,
          title: question.slice(0, 30),
          messages: conversation,
        };

        const exists = previous.some((item) => item.id === chatId);

        return exists
          ? previous.map((item) => (item.id === chatId ? chat : item))
          : [chat, ...previous];
      });
    } finally {
      setLoading(false);
    }
  }

  async function retryMessage() {
    if (loading || messages.length === 0) return;

    let lastUserIndex = -1;

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const conversation = messages.slice(0, lastUserIndex + 1);
    const lastQuestion = conversation[lastUserIndex].content;
    const chatId = activeChat ?? Date.now();

    setMessages(conversation);
    setActiveChat(chatId);
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to get a response from NovaAI."
        );
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("NovaAI returned an empty response. Please try again.");
      }

      const updated = [
        ...conversation,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: data.reply,
        },
      ];

      setMessages(updated);

      setChats((previous) => {
        const chat = {
          id: chatId,
          title: lastQuestion.slice(0, 30),
          messages: updated,
        };

        const exists = previous.some((item) => item.id === chatId);

        return exists
          ? previous.map((item) => (item.id === chatId ? chat : item))
          : [chat, ...previous];
      });
    } catch (err) {
      console.error("NovaAI retry error:", err);
      setError(
        err.message || "Retry failed. Please check that Ollama is running."
      );
    } finally {
      setLoading(false);
    }
  }

  async function regenerateMessage(messageId) {
    if (loading) return;

    const index = messages.findIndex((message) => message.id === messageId);

    if (index === -1 || messages[index].role !== "assistant") return;

    let userIndex = index - 1;

    while (userIndex >= 0 && messages[userIndex].role !== "user") {
      userIndex -= 1;
    }

    if (userIndex < 0) return;

    const conversation = messages.slice(0, userIndex + 1);
    const previousMessages = messages.slice(0, index);
    const lastQuestion = conversation[userIndex].content;
    const chatId = activeChat ?? Date.now();

    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to regenerate the response."
        );
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("NovaAI returned an empty response. Please try again.");
      }

      const updatedMessages = [
        ...previousMessages,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: data.reply,
        },
      ];

      setMessages(updatedMessages);

      setChats((previous) => {
        const chat = {
          id: chatId,
          title: lastQuestion.slice(0, 30),
          messages: updatedMessages,
        };

        const exists = previous.some((item) => item.id === chatId);

        return exists
          ? previous.map((item) => (item.id === chatId ? chat : item))
          : [chat, ...previous];
      });
    } catch (err) {
      console.error("NovaAI regenerate error:", err);
      setError(err.message || "Could not regenerate the response.");
    } finally {
      setLoading(false);
    }
  }

  function openChat(chat) {
    if (loading) return;

    setActiveChat(chat.id);
    setMessages(chat.messages);
    setInput("");
    setError("");
  }

  function deleteChat(id) {
    if (loading) return;

    setChats((previous) => previous.filter((chat) => chat.id !== id));

    if (activeChat === id) {
      setMessages([]);
      setInput("");
      setActiveChat(null);
      setError("");
    }
  }

  async function copyMessage(message, id) {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
      setError("Unable to copy this message. Please try again.");
    }
  }

  function exportChat() {
    if (messages.length === 0) {
      setError("There are no messages to export yet.");
      return;
    }

    const chatTitle =
      chats.find((chat) => chat.id === activeChat)?.title ||
      messages.find((message) => message.role === "user")?.content?.slice(0, 30) ||
      "NovaAI Conversation";

    const transcript = [
      "NovaAI Conversation",
      `Title: ${chatTitle}`,
      `Exported: ${new Date().toLocaleString()}`,
      "=".repeat(50),
      "",
      ...messages.map((message) => {
        const speaker = message.role === "assistant" ? "NovaAI" : "You";
        return `${speaker}:\n${message.content}\n`;
      }),
    ].join("\n");

    const blob = new Blob([transcript], {
      type: "text/plain;charset=utf-8",
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const safeTitle =
      chatTitle
        .replace(/[^a-z0-9\-_ ]/gi, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 40) || "conversation";

    link.href = downloadUrl;
    link.download = `NovaAI-${safeTitle}.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(downloadUrl);
    setError("");
  }

  return (
    <div className={`app-shell theme-${theme}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {sidebarOpen && (
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">✦</div>

            <span>
              Nova<span className="brand-accent">AI</span>
            </span>

            <button
              type="button"
              className="icon-button sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              ‹
            </button>
          </div>

          <button
            type="button"
            className="new-chat-button"
            onClick={newChat}
            disabled={loading}
          >
            <span>＋</span> New conversation
            <span className="shortcut">⌘ K</span>
          </button>

          <div className="sidebar-label">YOUR WORKSPACE</div>

<div className="chat-search">
  <span>⌕</span>
  <input
    type="search"
    placeholder="Search conversations..."
    value={searchQuery}
    onChange={(event) => setSearchQuery(event.target.value)}
    aria-label="Search conversations"
  />
  {searchQuery && (
    <button
      type="button"
      onClick={() => setSearchQuery("")}
      aria-label="Clear search"
    >
      ×
    </button>
  )}
</div>

          <div className="history-list">
            {chats.length === 0 ? (
              <p className="empty-history">
                Your conversations will appear here.
              </p>
            ) : (
              filteredChats.map((chat) => (
                <div
                  className={`history-item ${
                    activeChat === chat.id ? "active" : ""
                  }`}
                  key={chat.id}
                >
                  <button
                    type="button"
                    onClick={() => openChat(chat)}
                    disabled={loading}
                  >
                    <span className="history-icon">◷</span>
                    <span className="history-title">{chat.title}</span>
                  </button>

                  <button
                    type="button"
                    className="delete-chat"
                    onClick={() => deleteChat(chat.id)}
                    aria-label="Delete conversation"
                    title="Delete conversation"
                    disabled={loading}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="sidebar-bottom">
            <div className="profile-avatar">N</div>

            <div className="profile-text">
              <strong>NovaAI</strong>
              <span>Personal assistant</span>
            </div>

            <span className="profile-menu">•••</span>
          </div>
        </aside>
      )}

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && (
              <button
                type="button"
                className="icon-button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                ☰
              </button>
            )}

            <span className="mobile-brand">✦ NovaAI</span>
            <span className="model-label">AI Assistant</span>
          </div>

          <div className="topbar-right">
            <span className="status-dot" />

            <span className="status-text">
              {loading ? "Thinking..." : "AI chat"}
            </span>

            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "☀️" : "🌙"}
              <span>
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </span>
            </button>

            <button
              type="button"
              className="share-button"
              onClick={exportChat}
              disabled={messages.length === 0 || loading}
              title="Download this conversation as a text file"
            >
              ↓ <span>Export chat</span>
            </button>

            <button
              type="button"
              className="share-button"
              onClick={newChat}
              disabled={loading}
            >
              ＋ <span>New chat</span>
            </button>
          </div>
        </header>

        <section className="chat-area">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="hero-orb">
                <div className="orb-core">✦</div>
              </div>

              <div className="eyebrow">
                <span /> YOUR PERSONAL AI COMPANION
              </div>

              <h1>
                Ideas begin with
                <br />
                <span>a little curiosity.</span>
              </h1>

              <p className="welcome-description">
                Meet NovaAI. Your space to think, create, learn,
                and turn your ideas into something extraordinary.
              </p>

              <div className="suggestion-grid">
                {suggestions.map((item) => (
                  <button
                    type="button"
                    className="suggestion-card"
                    key={item.title}
                    onClick={() => sendMessage(item.prompt)}
                    disabled={loading}
                  >
                    <span className="suggestion-icon">{item.icon}</span>
                    <span className="suggestion-title">{item.title}</span>
                    <span className="suggestion-prompt">{item.prompt}</span>
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((message) => (
                <article
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className={`message-avatar ${message.role}`}>
                    {message.role === "assistant" ? "✦" : "Y"}
                  </div>

                  <div className="message-content">
                    <div className="message-author">
                      {message.role === "assistant" ? "NovaAI" : "You"}
                    </div>

                    <div className="message-text markdown-content">
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeHighlight]}
  >
    {message.content || ""}
  </ReactMarkdown>
</div>

                    {message.role === "assistant" && (
                      <div className="message-actions">
                        
<button
  type="button"
  className="message-action"
  onClick={() =>
    speakMessage(
      message.content,
      message.id
    )
  }
  title={
    speakingMessage === message.id
      ? "Stop speaking"
      : "Read aloud"
  }
  aria-label={
    speakingMessage === message.id
      ? "Stop speaking"
      : "Read aloud"
  }
>
  {speakingMessage === message.id ? "⏹️" : "🔊"}
</button>

                        <button
                          type="button"
                          onClick={() =>
                            copyMessage(message.content, message.id)
                          }
                        >
                          {copied === message.id ? "✓ Copied" : "▢ Copy"}
                        </button>

                        <button
                          type="button"
                          onClick={() => regenerateMessage(message.id)}
                          disabled={loading}
                        >
                          ↻ Regenerate
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}

              {loading && (
                <article className="message-row assistant">
                  <div className="message-avatar assistant">✦</div>

                  <div className="message-content">
                    <div className="message-author">NovaAI</div>
                    <div className="message-text">Thinking...</div>
                  </div>
                </article>
              )}

              {error && (
                <div className="chat-error" role="alert">
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={retryMessage}
                    disabled={
                      loading ||
                      !messages.some((message) => message.role === "user")
                    }
                  >
                    ↻ Retry
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <footer className="composer-section">
          {error && messages.length === 0 && (
            <div className="chat-error" role="alert">
              {error}
            </div>
          )}

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask NovaAI anything..."
              rows={2}
              aria-label="Message NovaAI"
              disabled={loading}
            />

            
<div className="composer-bottom">
  <span className="composer-hint">
    <span className="sparkle-small">✦</span>{" "}
    {loading ? "NovaAI is thinking..." : "Curious minds welcome"}
  </span>

  <div className="composer-actions">
    <button
      type="button"
      className={`voice-button ${isListening ? "listening" : ""}`}
      onClick={startVoiceInput}
      title="Speak your message"
      aria-label="Speak your message"
    >
      {isListening ? "🔴" : "🎤"}
    </button>

    <button
      type="submit"
      className="send-button"
      disabled={!input.trim() || loading}
      aria-label="Send message"
    >
      {loading ? "…" : "↑"}
    </button>
  </div>
</div>

          </form>

          <p className="disclaimer">
            NovaAI can make mistakes. Check important information.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
