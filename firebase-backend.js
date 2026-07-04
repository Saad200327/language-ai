/**
 * Language Ai V5 — Firebase Backend
 *
 * Handles Firebase Auth, Firestore, and AI response calls.
 * Replace the firebaseConfig values with your actual project credentials.
 * NEVER commit real API keys here — use environment variables or a .env file
 * that is listed in .gitignore.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, orderBy, query }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, signInAnonymously }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ─── Firebase config (replace with real values — keep secrets out of git) ─
const firebaseConfig = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID",
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// Sign in anonymously so Firestore rules can permit reads/writes
signInAnonymously(auth).catch(console.error);

/**
 * getAiResponse — calls a Firestore-backed Cloud Function or
 * a direct API endpoint to get an AI reply.
 *
 * @param {string} userMessage
 * @returns {Promise<string>} AI reply text
 */
export async function getAiResponse(userMessage) {
  // TODO: replace with your actual Cloud Function endpoint or API call
  // Example: return fetch('/api/chat', { method:'POST', body: JSON.stringify({message: userMessage}) }).then(r=>r.text())
  await addDoc(collection(db, 'chat_logs'), {
    role: 'user',
    message: userMessage,
    timestamp: Date.now(),
  });
  // Placeholder response — wire up real AI call here
  return `You said: "${userMessage}" — AI response placeholder (wire up your backend).`;
}

/**
 * getChatHistory — fetch past messages from Firestore
 * @returns {Promise<Array>}
 */
export async function getChatHistory() {
  const q = query(collection(db, 'chat_logs'), orderBy('timestamp'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}
