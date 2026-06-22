import { useState, useRef, useEffect } from "react";
import "./App.css";
import stiftungLogo from "./assets/Logo-Stiftung-Bildung-Bildmarke_quadratisch_RGB.png";

// Nachrichtentyp für die Darstellung im Chat.
interface Message {
  sender: "user" | "bot";
  text: string;
  source?: string;
  contact?: string;
  category?: string;
  confidence?: number;
  score?: number;
}

// Typ für die Antwort, die vom Backend zurückkommt.
interface ChatResponse {
  answer: string;
  source?: string;
  contact?: string;
}

function App() {
  // Steuert, ob der Chat sichtbar ist oder nur der Launcher-Button angezeigt wird.
  const [chatOpen, setChatOpen] = useState<boolean>(false);

  // Chatverlauf als Nachrichtenliste.
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hallo! Ich bin der Chatbot der Stiftung Bildung. Wie kann ich dir helfen?",
    },
  ]);

  // Inhalt des Eingabefeldes.
  const [input, setInput] = useState<string>("");

  // Ladezustand während der Backend-Anfrage.
  const [loading, setLoading] = useState<boolean>(false);

  // Referenz zum Ende des Nachrichtenbereichs für automatisches Scrollen.
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scrollt automatisch nach unten, wenn neue Nachrichten hinzukommen.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Senden der Benutzer-Nachricht an das Backend und Hinzufügen der Antwort zum Chat.
  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userText = input;

    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("https://stiftung-chatbot-backend.onrender.com/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: userText }),
      });

      if (!response.ok) {
        throw new Error(`Backend-Fehler: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: data.answer,
          source: data.source,
          contact: data.contact,
        },
      ]);
    } catch (error) {
      console.error("Fehler beim Senden der Nachricht:", error);

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Entschuldigung, da ist etwas schiefgelaufen. Bitte versuche es erneut.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Erlaubt das Absenden per Enter-Taste.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      sendMessage();
    }
  }

  return (
    <div className="page">
      {!chatOpen && (
        <button
          className="chat-launcher"
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Chat der Stiftung Bildung öffnen"
        >
          <span className="launcher-logo" aria-hidden="true">
            <img src={stiftungLogo} alt="" />
          </span>
          <span className="launcher-text">
            <span>Stiftung Bildung</span>
            <strong>Chat öffnen</strong>
          </span>
        </button>
      )}

      {chatOpen && (
        <div className="chat-card is-open">
          <header className="chat-header">
            <div className="logo-badge" aria-hidden="true">
              <img src={stiftungLogo} alt="" />
            </div>
            <div className="header-copy">
              <h1>Stiftung Bildung</h1>
              <p>Chatbot &mdash; Fragen rund um unsere Arbeit</p>
            </div>
            <button
              className="close-chat"
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Chat schließen"
            >
              x
            </button>
          </header>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message-row ${msg.sender === "user" ? "from-user" : "from-bot"
                }`}
            >
              {msg.sender === "bot" && (
                <div className="avatar" aria-hidden="true">
                  <img src={stiftungLogo} alt="" />
                </div>
              )}

              <div className="bubble">
                <p>{msg.text}</p>

                {msg.contact && (
                  <p className="meta">
                    📧 Kontakt:{" "}
                    <a href={`mailto:${msg.contact}`}>{msg.contact}</a>
                  </p>
                )}

                {msg.source && (
                  <a className="source-button" href={msg.source} target="_blank" rel="noreferrer">
                    Quelle ansehen ↗
                  </a>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row from-bot">
              <div className="avatar" aria-hidden="true">
                <img src={stiftungLogo} alt="" />
              </div>
              <div className="bubble typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>

        <div className="chat-input">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage eingeben..."
          />

          <button onClick={sendMessage} disabled={loading} aria-label="Senden">
            ➤
          </button>
        </div>
        </div>
      )}
    </div>
  );
}

export default App;
