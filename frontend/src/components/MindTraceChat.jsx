import { useState, useRef, useEffect } from "react";

// ── stress keyword detector (runs client-side before API call) ──
const STRESS_SIGNALS = {
  high: [
    "can't sleep", "cant sleep", "no sleep", "exhausted", "breaking down",
    "overwhelmed", "panic", "anxiety", "anxious", "depressed", "hopeless",
    "give up", "can't cope", "failing", "too much", "stressed out",
    "burnout", "burned out", "burnt out", "crying", "losing my mind",
    "mental breakdown", "can't handle", "cant handle", "drowning",
  ],
  medium: [
    "tired", "stressed", "worried", "struggling", "behind", "deadline",
    "pressure", "exam", "assignment", "missed", "procrastinating",
    "unmotivated", "distracted", "can't focus", "cant focus", "overwhelm",
    "hard", "difficult", "stuck", "confused", "lost",
  ],
  low: [
    "okay", "fine", "good", "managing", "coping", "alright", "decent",
    "getting by", "handling it", "okay i guess",
  ],
};

function detectStressLevel(text) {
  const lower = text.toLowerCase();
  if (STRESS_SIGNALS.high.some((s) => lower.includes(s))) return "high";
  if (STRESS_SIGNALS.medium.some((s) => lower.includes(s))) return "medium";
  if (STRESS_SIGNALS.low.some((s) => lower.includes(s))) return "low";
  return "unknown";
}

const STRESS_META = {
  high:    { label: "High stress detected",   color: "#f06060", icon: "⚠" },
  medium:  { label: "Moderate stress",         color: "#f5c842", icon: "◐" },
  low:     { label: "Doing okay",              color: "#3ecf8e", icon: "◎" },
  unknown: { label: "Analysing...",            color: "#7c6af7", icon: "◉" },
};

// ── system prompt sent to Claude ──
const SYSTEM_PROMPT = `You are MindTrace AI, a compassionate mental health support assistant embedded in a student burnout tracking app called MindTrace.

Your job is to:
1. Carefully read what the student says and detect signs of stress, burnout, anxiety, exhaustion, or emotional distress.
2. Respond with empathy, warmth, and understanding — never clinical or robotic.
3. If the student seems highly stressed or burnt out, gently acknowledge their feelings first, then offer 1-2 practical coping strategies (breathing, breaks, prioritising tasks, sleep hygiene, talking to someone).
4. If they seem okay, keep the conversation light and supportive.
5. Always end with a short follow-up question to keep them talking — it helps surface hidden stress.
6. Never diagnose. Never be preachy. Never give long lists. Keep responses conversational and human.
7. If you detect crisis-level distress (self-harm, suicidal thoughts), immediately and gently encourage them to speak to a counsellor or call a helpline.
8. You already know the student is using a burnout tracker, so you can reference that context naturally.

Tone: warm, calm, like a caring older student who gets it. Not a therapist. Not a bot.
Length: keep responses under 120 words unless the situation is serious.`;

// ── typing indicator ──
function TypingDots() {
  return (
    <div className="mt-msg ai">
      <div className="mt-bubble mt-bubble-ai mt-typing">
        <span /><span /><span />
      </div>
    </div>
  );
}

// ── stress badge ──
function StressBadge({ level }) {
  const meta = STRESS_META[level];
  return (
    <div className="mt-stress-badge" style={{ borderColor: meta.color + "40", color: meta.color }}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
    </div>
  );
}

// ── main component ──
export default function MindTraceChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hey 👋 I'm your MindTrace support assistant. How are you holding up today?",
      stress: "unknown",
      id: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [overallStress, setOverallStress] = useState("unknown");
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const idRef = useRef(1);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const stress = detectStressLevel(text);
    const userMsg = { role: "user", content: text, stress, id: idRef.current++ };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // update overall stress — high always wins, then medium
    setOverallStress((prev) => {
      if (stress === "high" || prev === "high") return "high";
      if (stress === "medium" || prev === "medium") return "medium";
      if (stress === "low") return "low";
      return prev;
    });

    try {
      // build conversation history for Claude (exclude our custom fields)
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));

      const res = await fetch("http://localhost:5000/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: text,
    history,
    stress,
  }),
});

const data = await res.json();

const reply = data.reply;

      const aiMsg = {
        role: "assistant",
        content: reply,
        stress: "unknown",
        id: idRef.current++,
      };

      setMessages((prev) => [...prev, aiMsg]);
      if (!open) setUnread((n) => n + 1);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I lost connection for a second. Try sending that again?",
          stress: "unknown",
          id: idRef.current++,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    setMessages([{
      role: "assistant",
      content: "Hey 👋 I'm your MindTrace support assistant. How are you holding up today?",
      stress: "unknown",
      id: idRef.current++,
    }]);
    setOverallStress("unknown");
  };

  return (
    <>
      {/* ── styles injected inline so this is truly one file ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@300;400;500&display=swap');

        .mt-root {
          --bg:      #0a0a0f;
          --bg2:     #111118;
          --bg3:     #18181f;
          --border:  #2a2a35;
          --text:    #e8e8f0;
          --muted:   #6b6b80;
          --accent:  #7c6af7;
          --adim:    rgba(124,106,247,0.12);
          --green:   #3ecf8e;
          --yellow:  #f5c842;
          --red:     #f06060;
          --r:       12px;
          font-family: 'DM Mono', monospace;
        }

        /* fab */
        .mt-fab {
          position: fixed;
          bottom: 28px;
          right: 28px;
          z-index: 999;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: var(--accent);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 8px 30px rgba(124,106,247,0.4);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .mt-fab:hover {
          transform: scale(1.08);
          box-shadow: 0 12px 40px rgba(124,106,247,0.55);
        }
        .mt-fab-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--red);
          color: #fff;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Mono', monospace;
        }

        /* window */
        .mt-window {
          position: fixed;
          bottom: 96px;
          right: 28px;
          z-index: 998;
          width: 370px;
          height: 540px;
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: var(--r);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.6);
          animation: mt-slide-up 0.25s ease;
        }

        @keyframes mt-slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* header */
        .mt-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
          flex-shrink: 0;
        }
        .mt-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--adim);
          border: 1px solid var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }
        .mt-header-info { flex: 1; min-width: 0; }
        .mt-header-name {
          font-family: 'Syne', sans-serif;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--text);
        }
        .mt-header-status {
          font-size: 10px;
          color: var(--green);
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 1px;
        }
        .mt-status-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--green);
          animation: mt-pulse 1.8s ease-in-out infinite;
        }
        @keyframes mt-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(0.7); }
        }
        .mt-header-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .mt-icon-btn {
          background: transparent;
          border: none;
          color: var(--muted);
          font-size: 14px;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 6px;
          transition: color 0.2s, background 0.2s;
          font-family: 'DM Mono', monospace;
        }
        .mt-icon-btn:hover { color: var(--text); background: var(--bg3); }

        /* stress banner */
        .mt-stress-badge {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid;
          flex-shrink: 0;
          background: var(--bg);
        }

        /* messages */
        .mt-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .mt-messages::-webkit-scrollbar { width: 3px; }
        .mt-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

        .mt-msg {
          display: flex;
          flex-direction: column;
        }
        .mt-msg.user { align-items: flex-end; }
        .mt-msg.ai   { align-items: flex-start; }

        .mt-bubble {
          max-width: 82%;
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.6;
          word-break: break-word;
        }
        .mt-bubble-user {
          background: var(--accent);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .mt-bubble-ai {
          background: var(--bg3);
          border: 1px solid var(--border);
          color: var(--text);
          border-bottom-left-radius: 4px;
        }

        /* stress indicator on user bubble */
        .mt-bubble-user.stress-high   { background: #8b2020; border: 1px solid var(--red); }
        .mt-bubble-user.stress-medium { background: #6b5200; border: 1px solid var(--yellow); }

        /* typing dots */
        .mt-typing {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 12px 16px;
        }
        .mt-typing span {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--muted);
          display: inline-block;
          animation: mt-bounce 1.2s ease-in-out infinite;
        }
        .mt-typing span:nth-child(2) { animation-delay: 0.15s; }
        .mt-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes mt-bounce {
          0%,80%,100% { transform: translateY(0); }
          40%          { transform: translateY(-6px); }
        }

        /* timestamp */
        .mt-time {
          font-size: 9px;
          color: var(--muted);
          margin-top: 3px;
          padding: 0 4px;
        }

        /* input area */
        .mt-input-area {
          padding: 12px 14px;
          border-top: 1px solid var(--border);
          background: var(--bg);
          display: flex;
          align-items: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }
        .mt-textarea {
          flex: 1;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 10px;
          color: var(--text);
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          padding: 10px 12px;
          resize: none;
          outline: none;
          max-height: 100px;
          line-height: 1.5;
          transition: border-color 0.2s;
        }
        .mt-textarea:focus { border-color: var(--accent); }
        .mt-textarea::placeholder { color: var(--muted); }

        .mt-send-btn {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: var(--accent);
          border: none;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: opacity 0.2s, transform 0.15s;
        }
        .mt-send-btn:hover:not(:disabled) { opacity: 0.85; transform: scale(1.05); }
        .mt-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }

        /* quick prompts */
        .mt-quick {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          padding: 8px 14px 0;
          flex-shrink: 0;
          background: var(--bg);
        }
        .mt-quick-btn {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          padding: 4px 10px;
          border-radius: 20px;
          background: var(--bg3);
          border: 1px solid var(--border);
          color: var(--muted);
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .mt-quick-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--adim);
        }

        @media (max-width: 480px) {
          .mt-window {
            right: 0; bottom: 0;
            width: 100vw;
            height: 100dvh;
            border-radius: 0;
          }
          .mt-fab { bottom: 20px; right: 20px; }
        }
      `}</style>

      <div className="mt-root">
        {/* floating action button */}
        <button className="mt-fab" onClick={() => setOpen((o) => !o)} aria-label="Open chat">
          {open ? "✕" : "💬"}
          {!open && unread > 0 && (
            <span className="mt-fab-badge">{unread}</span>
          )}
        </button>

        {/* chat window */}
        {open && (
          <div className="mt-window">
            {/* header */}
            <div className="mt-header">
              <div className="mt-avatar">🧠</div>
              <div className="mt-header-info">
                <div className="mt-header-name">MindTrace AI</div>
                <div className="mt-header-status">
                  <span className="mt-status-dot" />
                  online · stress analysis active
                </div>
              </div>
              <div className="mt-header-actions">
                <button className="mt-icon-btn" title="Clear chat" onClick={clearChat}>↺</button>
                <button className="mt-icon-btn" title="Close" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>

            {/* stress banner */}
            <StressBadge level={overallStress} />

            {/* quick prompts — only show at start */}
            {messages.length === 1 && (
              <div className="mt-quick">
                {[
                  "I'm really stressed 😩",
                  "Can't sleep at all",
                  "Behind on assignments",
                  "I'm okay today",
                ].map((q) => (
                  <button
                    key={q}
                    className="mt-quick-btn"
                    onClick={() => { setInput(q); inputRef.current?.focus(); }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* messages */}
            <div className="mt-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`mt-msg ${msg.role === "user" ? "user" : "ai"}`}>
                  <div
                    className={[
                      "mt-bubble",
                      msg.role === "user" ? "mt-bubble-user" : "mt-bubble-ai",
                      msg.role === "user" && msg.stress !== "unknown"
                        ? `stress-${msg.stress}`
                        : "",
                    ].join(" ")}
                  >
                    {msg.content}
                  </div>
                  <span className="mt-time">
                    {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              {loading && <TypingDots />}
              <div ref={bottomRef} />
            </div>

            {/* input */}
            <div className="mt-input-area">
              <textarea
                ref={inputRef}
                className="mt-textarea"
                rows={1}
                placeholder="How are you feeling..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                }}
              />
              <button
                className="mt-send-btn"
                onClick={send}
                disabled={!input.trim() || loading}
                aria-label="Send"
              >
                ↑
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
