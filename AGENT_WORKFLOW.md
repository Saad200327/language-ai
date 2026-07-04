# AGENT_WORKFLOW.md

## Source of Truth

This GitHub repository (`saadx200327/language-ai`) is the **single source of truth** for the Language Ai project.

Future AI improvement loops (hourly or otherwise) must read and edit files directly from this repo. **Do NOT rely on temporarily uploaded zip files** — those paths (e.g., `/mnt/data/language-ai-v5-firebase.zip`) are not available between separate automation runs and will cause the loop to fail.

---

## Rules for AI Improvement Agents

1. **Read from the repo, write to the repo.**  
   Clone or fetch files via the GitHub API / MCP tools. Edit the actual `.js`, `.html`, `.css` files here.

2. **Never touch the live Netlify site automatically.**  
   The Netlify deploy is triggered manually (see Deployment section below). Automated runs must not push to `main` or trigger any Netlify build hook.

3. **All new changes go on separate feature branches.**  
   Branch naming convention: `improvement/YYYY-MM-DD-short-description`  
   Example: `improvement/2026-07-04-optimize-chat-ui`

4. **Weekly deploys are manual.**  
   Once a week, reviewed changes are merged to `main` and Netlify is deployed manually by the project owner.

5. **Latest stable baseline is `baseline-v5-firebase`.**  
   This branch contains the last known-good V5 source. Improvement agents should branch off `baseline-v5-firebase` (or `main` once updated) — never rewrite `baseline-v5-firebase` itself.

6. **Do NOT commit passwords, API keys, or private credentials.**  
   The `firebase-backend.js` file contains only placeholder strings like `REPLACE_WITH_YOUR_API_KEY`. Real credentials live in a `.env` file or Firebase config outside of version control.

---

## Improvement Loop Workflow (Hourly Agent)

```
1. Fetch latest files from this repo (branch: baseline-v5-firebase or main)
2. Read: index.html, styles.css, app.js, firebase-backend.js, sw.js
3. Apply improvement (refactor, new feature, bug fix)
4. Push to a new branch: improvement/YYYY-MM-DD-HH-description
5. Open a Pull Request for human review
6. Do NOT merge automatically
7. Do NOT deploy to Netlify
```

---

## File Map

| File | Purpose |
|---|---|
| `index.html` | App shell and entry point |
| `styles.css` | All visual styles |
| `app.js` | Main app logic, lesson rendering, chat UI |
| `firebase-backend.js` | Firebase init, Firestore reads/writes, AI calls |
| `FIRESTORE_RULES.txt` | Firestore security rules (paste into Firebase Console) |
| `sw.js` | Service worker — offline caching |
| `README.md` | Project overview |
| `AGENT_WORKFLOW.md` | This file — agent instructions |

---

## Deployment

- **Live site:** Netlify (manual deploy only)
- **Trigger:** Project owner merges `main` and clicks "Deploy" in Netlify dashboard
- **Automated agents must never trigger a Netlify deploy**

---

## Why This Exists

The previous hourly improvement loop stopped because ChatGPT's automation runtime could not access the uploaded zip file at `/mnt/data/language-ai-v5-firebase.zip` during later scheduled runs. Uploaded files are session-scoped and unavailable in subsequent automation turns.

By keeping all source files as normal, editable GitHub files, any future AI agent can reliably clone, read, patch, and push changes without depending on a temporary upload.
