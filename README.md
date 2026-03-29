# AI Chatbot — OpenRouter Free Models

A simple chatbot powered by [OpenRouter](https://openrouter.ai) free-tier models, deployed on Netlify.

## Project Structure

```
chatbot/
├── index.html                    # Frontend UI
├── script.js                     # Frontend logic
├── netlify.toml                  # Netlify config
├── package.json
└── netlify/
    └── functions/
        └── ai-faq.js             # ← Serverless function (was missing!)
```

## Fix for 404 Error

The 404 was caused by `netlify/functions/ai-faq.js` **not being committed to GitHub**.  
This file is now included — make sure to commit the entire `netlify/` folder.

## Netlify Environment Variable

In Netlify → Site Settings → Environment Variables, add:

| Key                  | Value               |
|----------------------|---------------------|
| `OPENROUTER_API_KEY` | `your-api-key-here` |

Get your free API key at: https://openrouter.ai/keys

## Deploy

```bash
git add .
git commit -m "Add netlify function and updated models"
git push
```

Netlify will auto-deploy from GitHub.
