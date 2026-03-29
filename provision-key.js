/**
 * netlify/functions/provision-key.js
 *
 * The ONLY server-side function in this project.
 * Called once per session to mint a fresh, limited child key from OpenRouter.
 * The child key is sent to the browser and used directly to call OpenRouter.
 * Your real provisioning key never leaves the server.
 *
 * Required Netlify env vars:
 *   OPENROUTER_PROVISIONING_KEY  — from openrouter.ai/settings/provisioning-keys
 *   OPENROUTER_API_KEY           — fallback regular key (used if provisioning fails)
 */
exports.handler = async function (event) {
  // CORS headers so the browser can call this
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const provisioningKey = process.env.OPENROUTER_PROVISIONING_KEY;
  const fallbackKey     = process.env.OPENROUTER_API_KEY;

  // If no provisioning key, return the fallback directly (degraded mode)
  if (!provisioningKey) {
    if (fallbackKey) {
      console.warn("No provisioning key — using fallback API key");
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ key: fallbackKey, mode: "fallback" })
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "No API keys configured on server." })
    };
  }

  // Session key expires 2 hours from now
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  try {
    const res = await fetch("https://openrouter.ai/api/v1/keys", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${provisioningKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: `session-${Date.now()}`,
        limit: 0.50,           // $0.50 per session — more than enough for free models
        limit_reset: "daily",  // resets at midnight UTC
        expires_at: expiresAt
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenRouter provisioning error:", res.status, errText);

      // Graceful fallback: return regular key if provisioning fails
      if (fallbackKey) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ key: fallbackKey, mode: "fallback" })
        };
      }
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: `Provisioning failed: ${res.status}` })
      };
    }

    const data = await res.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        key: data.key,
        expires_at: expiresAt,
        mode: "provisioned"
      })
    };

  } catch (err) {
    console.error("provision-key error:", err);
    if (fallbackKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ key: fallbackKey, mode: "fallback" })
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server error: " + err.message })
    };
  }
};
