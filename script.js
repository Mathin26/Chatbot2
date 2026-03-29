const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const modelSelect = document.getElementById("model-select");

let messageIdCounter = 0;

// Send on button click
sendBtn.addEventListener("click", sendMessage);

// Send on Enter key
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  const selectedModel = modelSelect.value;

  appendMessage("You", message, "user");
  userInput.value = "";
  sendBtn.disabled = true;

  const loadingId = appendMessage("AI", "Thinking…", "ai loading");

  try {
    const response = await fetch("/.netlify/functions/ai-faq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: message, model: selectedModel })
    });

    removeMessage(loadingId);

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      appendMessage("AI", `Error ${response.status}: ${err.error || response.statusText}`, "ai");
      return;
    }

    const data = await response.json();
    appendMessage("AI", data.answer || "No response received.", "ai");

  } catch (err) {
    removeMessage(loadingId);
    appendMessage("AI", "Network error: " + err.message, "ai");
  } finally {
    sendBtn.disabled = false;
    userInput.focus();
  }
}

function appendMessage(sender, text, className) {
  const div = document.createElement("div");
  const id = `msg-${messageIdCounter++}`;
  div.id = id;
  div.className = `message ${className}`;

  const senderEl = document.createElement("div");
  senderEl.className = "sender";
  senderEl.textContent = sender;

  const textEl = document.createElement("div");
  textEl.textContent = text;

  div.appendChild(senderEl);
  div.appendChild(textEl);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return id;
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
