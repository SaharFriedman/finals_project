
import { useEffect, useState } from "react";
import { getHelperContext, postChat } from "../api/helper";
// this is the my-helper page, a bot using chatGPT for my garden. with tools, action memories and more
export default function MyHelper() {
  // the plants of the user
  const [plants, setPlants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  // getting the plants to provide garden context
  useEffect(() => {
    (async () => {
      try {
        const ctx = await getHelperContext();
        setPlants(ctx.plants || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);


  async function send() {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    // each user input is declared as a user message
    setMessages(m => [...m, { role: "user", text }]);
    // sending the API
    setBusy(true);
    try {
      // each API's output is declaired as an assistent message
      const { reply } = await postChat(text, null);
      setMessages(m => [...m, { role: "assistant", text: reply }]);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", text: "Error. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    /* parsing context to screen */
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "16px", height: "calc(100vh - 80px)", padding: "16px" }}>
      <aside style={{ overflow: "auto", borderRight: "1px solid #333", paddingRight: 12 }}>
        <h2>My plants</h2>
        {plants.map(p => (
          <div key={p.plant_id} style={{ padding: "8px 0", borderBottom: "1px solid #333" }}>
            <div style={{ fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontSize: 12 }}>Last water: {p.last_water ? `${new Date(p.last_water.at).toLocaleString()} - ${p.last_water.amount||""} ${p.last_water.units||""}` : "none"}</div>
          </div>
        ))}
      </aside>
      <main style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, overflow: "auto", paddingBottom: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ margin: "8px 0", display: "flex" }}>
              <div style={{ width: 80, textAlign: "right", paddingRight: 8, opacity: 0.7 }}>{m.role}:</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          ))}
        </div>
      {/* form settings */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="Ask anything - e.g., When did I water my tomatoes?"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(); }}
            style={{ flex: 1, padding: 10 }}
            disabled={busy}
          />
          <button onClick={send} disabled={busy || !input.trim()}>{busy ? "..." : "Send"}</button>
        </div>
      </main>
    </div>
  );
}
