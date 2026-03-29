exports.handler = async function (event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const userMessage = body.user;
  const model = body.model || "google/gemma-2-9b-it:free";

  if (!userMessage) {
    return { statusCode: 400, body: JSON.stringify({ error: "No user message provided" }) };
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: "API key not configured" }) };
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-site.netlify.app", // Optional: update with your real site URL
        "X-Title": "AI Chatbot"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "user", content: userMessage }
        ],
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `OpenRouter API error: ${response.status}` })
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "No response from model.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer })
    };

  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error: " + err.message })
    };
  }
};
