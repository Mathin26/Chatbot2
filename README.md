# AI Chatbot v3

## Why this fixes the 404

**Old approach:** Browser → Netlify function (ai-faq.js) → OpenRouter  
**New approach:** Browser → Netlify function (provision-key.js) → returns key  
                  Browser → **OpenRouter directly** using that key ✅

There is now only ONE Netlify function (`provision-key.js`). Chat calls go
directly from the browser to OpenRouter. No second function to 404.

## File structure

```
├── index.html
├── script.js
├── netlify.toml
├── package.json
└── netlify/
    └── functions/
        └── provision-key.js   ← THE ONLY SERVER FUNCTION
```

## Netlify Environment Variables

Site Settings → Environment Variables → Add:

| Variable                      | Required? | Description                                  |
|-------------------------------|-----------|----------------------------------------------|
| `OPENROUTER_PROVISIONING_KEY` | ✅ Yes     | From openrouter.ai/settings/provisioning-keys |
| `OPENROUTER_API_KEY`          | Optional  | Fallback if provisioning fails               |

### Getting a Provisioning Key (different from a regular key!)
1. Log in to openrouter.ai
2. Go to **Settings → Provisioning Keys**
3. Click **Create New Key**
4. Copy it → paste as `OPENROUTER_PROVISIONING_KEY` in Netlify

## Deploy

```bash
git add .
git commit -m "v3: fix 404, direct browser-to-OpenRouter chat"
git push
```
