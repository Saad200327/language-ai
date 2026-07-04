/**
 * Language Ai V5 — Main App Logic
 *
 * Improvement loop agents should edit THIS file for app behavior changes.
 * Do NOT rely on uploaded zip files — this repo is the source of truth.
 */

import { getAiResponse } from './firebase-backend.js';

// ─── State ────────────────────────────────────────────────────────────────
const state = {
  currentLesson: 0,
  lessons: [],
};

// ─── DOM refs ─────────────────────────────────────────────────────────────
const lessonContent  = document.getElementById('lesson-content');
const chatMessages   = document.getElementById('chat-messages');
const chatForm       = document.getElementById('chat-form');
const chatInput      = document.getElementById('chat-input');
const btnNext        = document.getElementById('btn-next');
const btnPrev        = document.getElementById('btn-prev');

// ─── Lessons (placeholder — replace with Firestore fetch if needed) ───────
state.lessons = [
  { title: 'Lesson 1: Greetings', body: 'Learn basic greetings in your target language.' },
  { title: 'Lesson 2: Numbers',   body: 'Count from 1 to 20 and use numbers in sentences.' },
  { title: 'Lesson 3: Colors',    body: 'Identify and describe colors around you.' },
];

// ─── Render lesson ────────────────────────────────────────────────────────
function renderLesson() {
  const lesson = state.lessons[state.currentLesson];
  if (!lesson) return;
  lessonContent.innerHTML = `
    <h2>${lesson.title}</h2>
    <p>${lesson.body}</p>
    <p style="font-size:.8rem;color:#6b7280;margin-top:.5rem">Lesson ${state.currentLesson + 1} of ${state.lessons.length}</p>
  `;
  btnPrev.disabled = state.currentLesson === 0;
  btnNext.disabled = state.currentLesson === state.lessons.length - 1;
}

btnNext.addEventListener('click', () => {
  if (state.currentLesson < state.lessons.length - 1) {
    state.currentLesson++;
    renderLesson();
  }
});

btnPrev.addEventListener('click', () => {
  if (state.currentLesson > 0) {
    state.currentLesson--;
    renderLesson();
  }
});

// ─── Chat ─────────────────────────────────────────────────────────────────
function appendMessage(text, role = 'user') {
  const el = document.createElement('div');
  el.className = `message message-${role}`;
  el.style.cssText = `
    align-self: ${role === 'user' ? 'flex-end' : 'flex-start'};
    background: ${role === 'user' ? '#01696f' : '#f3f4f6'};
    color: ${role === 'user' ? '#fff' : '#1a1a1a'};
    padding: .5rem .75rem;
    border-radius: .5rem;
    max-width: 80%;
    font-size: .9rem;
    line-height: 1.5;
  `;
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  appendMessage(text, 'user');

  try {
    const reply = await getAiResponse(text);
    appendMessage(reply, 'ai');
  } catch (err) {
    appendMessage('Error: Could not reach AI backend.', 'ai');
    console.error(err);
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────
renderLesson();
