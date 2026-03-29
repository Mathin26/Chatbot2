/**
 * script.js
 *
 * Architecture:
 *   1. On load → POST /.netlify/functions/provision-key
 *      Server mints a fresh child key ($0.50 limit, 2hr expiry) and returns it.
 *   2. All chat requests go DIRECTLY from the browser to OpenRouter using
 *      that child key — no second Netlify function needed, no 404 risk.
 *   3. Key auto-renews 5 min before expiry. On 401/429 it reprovisions silently.
 *   4. Full conversation history maintained for multi-turn chat.
 */

const $ = id => document.getElementById(id);
const sendBtn    = $("send-btn");
const userInput  = $("user-input");
const chatBox    = $("chat-box");
const modelSel   = $("model-select");
const dot        = $("dot");
const keyStatus  = $("key-status");

const OPENROUTER_CHAT = "https://openrouter.ai/api/v1/chat/completions";

let sessionKey  = null;
let expiresAt   = null;
let history     = [];   // [{role, content}]
let msgId       = 0;

// ── Key provisioning ─────────────────────────────────────────────────────────

async function provisionKey() {
  setStatus("loading", "Getting session key…");
  try {
    const res = await fetch("/.netlify/functions/provision-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.key) throw new Error("No key in response");

    sessionKey = data.key;
    expiresAt  = data.expires_at ? new Date(data.expires_at) : null;

    const mode = data.mode === "fallback" ? "Shared key (active)" : "Session key ready";
    setStatus("ok", mode);
    enableInput();

    // Schedule silent renewal 5 min before expiry
    if (expiresAt) {
      const renewIn = expiresAt - Date.now() - 5 * 60 * 1000;
      if (renewIn > 0) setTimeout(provisionKey, renewIn);
    }
  } catch (err) {
    console.error("provisionKey failed:", err);
    setStatus("err", "Key error — refresh page");
    // Don't disable input — let user try anyway; error will surface in chat
    enableInput();
  }
}

function setStatus(state, label) {
  dot.className = "dot" + (state !== "loading" ? ` ${state}` : "");
  keyStatus.textContent = label;
}

function enableInput() {
  userInput.disabled = false;
  sendBtn.disabled   = false;
  userInput.focus();
}

// ── Sending messages ─────────────────────────────────────────────────────────

sendBtn.addEventListener("click", send);
userInput.addEventListener("keypress", e => { if (e.key === "Enter") send(); });

async function send() {
  const text = userInput.value.trim();
  if (!text || sendBtn.disabled) return;

  // Remove welcome screen
  const wel = chatBox.querySelector(".welcome");
  if (wel) wel.remove();

  const model = modelSel.value;
  appendMsg("You", text, "user");
  userInput.value = "";
  setInputLock(true);
  const lid = appendLoading();

  try {
    // Reprovision if key expired
    if (expiresAt && Date.now() >= expiresAt) await provisionKey();

    if (!sessionKey) throw new Error("No session key — please refresh the page.");

    const messages = [...history, { role: "user", content: text }];

    const res = await fetch(OPENROUTER_CHAT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": location.origin,
        "X-Title": "AI Chatbot"
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    removeMsg(lid);

    // Handle key exhaustion / rate limit — reprovision and retry once
    if (res.status === 401 || res.status === 429 || res.status === 402) {
      appendMsg("System", "Refreshing session key…", "ai");
      await provisionKey();
      return retrySend(text, model);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg  = errData?.error?.message || `Error ${res.status}`;
      appendMsg("AI", errMsg, "ai");
      return;
    }

    const data   = await res.json();
    const answer = data.choices?.[0]?.message?.content || "No response.";
    const modelShort = model.split("/").pop().replace(":free", "");

    appendMsg("AI", answer, "ai", modelShort);

    // Update history (keep last 20 messages = 10 exchanges)
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: answer });
    if (history.length > 20) history = history.slice(-20);

  } catch (err) {
    removeMsg(lid);
    appendMsg("AI", "⚠️ " + err.message, "ai");
  } finally {
    setInputLock(false);
  }
}

async function retrySend(text, model) {
  const lid = appendLoading();
  try {
    const messages = [...history, { role: "user", content: text }];
    const res = await fetch(OPENROUTER_CHAT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sessionKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": location.origin,
        "X-Title": "AI Chatbot"
      },
      body: JSON.stringify({ model, messages, max_tokens: 1024 })
    });
    removeMsg(lid);
    const data   = await res.json();
    const answer = data.choices?.[0]?.message?.content || data?.error?.message || "No response.";
    appendMsg("AI", answer, "ai");
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: answer });
  } catch (err) {
    removeMsg(lid);
    appendMsg("AI", "Retry failed: " + err.message, "ai");
  } finally {
    setInputLock(false);
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function setInputLock(locked) {
  sendBtn.disabled   = locked;
  userInput.disabled = locked;
  if (!locked) userInput.focus();
}

function appendMsg(sender, text, cls, modelName) {
  const id = `m${msgId++}`;
  const wrap = document.createElement("div");
  wrap.className = `msg ${cls}`;
  wrap.id = id;

  const bub = document.createElement("div");
  bub.className = "bubble";
  bub.textContent = text;

  const meta = document.createElement("div");
  meta.className = "meta";
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  meta.textContent = modelName ? `${time} · ${modelName}` : time;

  wrap.appendChild(bub);
  wrap.appendChild(meta);
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
  return id;
}

function appendLoading() {
  const id = `m${msgId++}`;
  const wrap = document.createElement("div");
  wrap.className = "msg ai loading";
  wrap.id = id;
  const bub = document.createElement("div");
  bub.className = "bubble";
  bub.innerHTML = `<div class="dots"><span></span><span></span><span></span></div>`;
  wrap.appendChild(bub);
  chatBox.appendChild(wrap);
  chatBox.scrollTop = chatBox.scrollHeight;
  return id;
}

function removeMsg(id) {
  document.getElementById(id)?.remove();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
provisionKey();
