# Language Ai V5 — Firebase Edition

An AI-powered language learning web app with Firebase backend.

## Stack

- **Frontend:** Vanilla HTML/CSS/JavaScript (ES Modules)
- **Backend:** Firebase Firestore + Firebase Auth (anonymous sign-in)
- **PWA:** Service Worker for offline caching
- **Hosting:** Netlify (manual deploy)

## Getting Started

1. Clone this repo
2. Replace the placeholder values in `firebase-backend.js` with your actual Firebase project credentials
3. Paste the contents of `FIRESTORE_RULES.txt` into your Firebase Console > Firestore > Rules
4. Open `index.html` in a browser or deploy to Netlify

## Repo Structure

```
language-ai/
├── index.html            # App entry point
├── styles.css            # All styles
├── app.js                # Main app logic
├── firebase-backend.js   # Firebase + AI backend
├── FIRESTORE_RULES.txt   # Paste into Firebase Console
├── sw.js                 # Service worker
├── AGENT_WORKFLOW.md     # Rules for AI improvement agents
└── README.md             # This file
```

## Branches

| Branch | Purpose |
|---|---|
| `main` | Stable, deployed version |
| `baseline-v5-firebase` | V5 Firebase source baseline |
| `improvement/*` | AI-generated improvement PRs (not auto-merged) |

## ⚠️ Security

Never commit real Firebase API keys or credentials. Use `.env` files or Firebase App Check.

## Agent Workflow

See [AGENT_WORKFLOW.md](./AGENT_WORKFLOW.md) for how future AI improvement loops should interact with this repo.
