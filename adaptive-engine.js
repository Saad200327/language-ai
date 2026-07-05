/*
Language Ai - Adaptive Progression Engine
Version: V5.2.1 Adaptive Self-Hookup

Changelog:
- V5.2.1: Self-hookup boot system added.
  * On DOMContentLoaded, watches #screen via MutationObserver.
  * Auto-injects #adaptiveSmartPlan on Home screen.
  * Auto-injects #adaptiveWeakWords on Review screen.
  * Document-level click listener tracks real attempts from
    .choice, .memory-card, .tile, [data-answer], [data-master],
    [data-tile], #checkBtn, #saidBtn, #recordBtn.
  * Infers correct/wrong from post-click DOM state (150ms delay).
  * Records typed/spoken/built/matched answers with activity type.
  * Dedupe protection: ignores identical attempt within 600ms.
  * Re-renders adaptive UI after every recorded attempt.
- V5.2: Added self-contained adaptive progression engine.
  * Tracks every answer attempt (course, lesson, item, activity type, correct/wrong, time).
  * Per-item mastery model (0..1) with weak/learning/solid/mastered labels.
  * Spaced review scheduling (dueAt) per difficulty.
  * Weak Words list, Due review list, Smart Lesson Mix, Smart Plan message.
  * Renders a Today's Smart Plan card and a Weak Words card into optional mount points.

Design notes:
- This module is fully additive. It NEVER touches the app's STORAGE_KEY
  or the existing state object. It uses its own key: language_ai_adaptive_v1.
- All public helpers are exposed on window.LanguageAiAdaptive.
- Everything is defensive: if a DOM mount point or global is missing,
  the engine silently no-ops so the base app keeps working.
*/
(function () {
'use strict';

var ADAPTIVE_KEY = 'language_ai_adaptive_v1';
var SCHEMA_VERSION = 1;
var START_MASTERY = 0.25;

// due intervals in milliseconds
var DUE = {
weak: 10 * 60 * 1000,
learning: 24 * 60 * 60 * 1000,
solid: 3 * 24 * 60 * 60 * 1000,
mastered: 7 * 24 * 60 * 60 * 1000
};

function now() { return Date.now(); }

function normalizeText(s) {
return String(s == null ? '' : s)
.toLowerCase()
.replace(/[.,!?;:\u0964]/g, '')
.replace(/\s+/g, ' ')
.trim();
}

function freshAdaptiveState() {
return {
schemaVersion: SCHEMA_VERSION,
attempts: [],
items: {},
updatedAtMs: now()
};
}

function getAdaptiveState() {
try {
var raw = localStorage.getItem(ADAPTIVE_KEY);
if (!raw) { return freshAdaptiveState(); }
var parsed = JSON.parse(raw);
if (!parsed || typeof parsed !== 'object') { return freshAdaptiveState(); }
if (!Array.isArray(parsed.attempts)) { parsed.attempts = []; }
if (!parsed.items || typeof parsed.items !== 'object') { parsed.items = {}; }
parsed.schemaVersion = SCHEMA_VERSION;
return parsed;
} catch (e) {
return freshAdaptiveState();
}
}

function saveAdaptiveState(stateObj) {
try {
var s = stateObj || freshAdaptiveState();
s.updatedAtMs = now();
if (s.attempts.length > 400) { s.attempts = s.attempts.slice(-400); }
localStorage.setItem(ADAPTIVE_KEY, JSON.stringify(s));
return true;
} catch (e) {
return false;
}
}

function labelFor(mastery) {
var m = Number(mastery) || 0;
if (m < 0.30) { return 'weak'; }
if (m < 0.50) { return 'learning'; }
if (m < 0.75) { return 'solid'; }
return 'mastered';
}

function dueDelayFor(label) {
if (label === 'weak') { return DUE.weak; }
if (label === 'learning') { return DUE.learning; }
if (label === 'solid') { return DUE.solid; }
if (label === 'mastered') { return DUE.mastered; }
return DUE.weak;
}

function buildItemKey(attempt) {
var a = attempt || {};
var courseId = a.courseId || 'unknown';
if (a.itemId) { return courseId + '::' + a.itemId; }
var lessonId = a.lessonId == null ? 'day?' : a.lessonId;
var type = a.activityType || 'quiz';
var prompt = normalizeText(a.prompt || a.correct || '');
return courseId + '::' + lessonId + '::' + type + '::' + prompt;
}

function freshItem(key, attempt) {
var a = attempt || {};
return {
key: key,
courseId: a.courseId || 'unknown',
lessonId: a.lessonId == null ? null : a.lessonId,
prompt: a.prompt || '',
correct: a.correct || '',
activityType: a.activityType || 'quiz',
seen: 0,
correctCount: 0,
wrongCount: 0,
streak: 0,
mastery: START_MASTERY,
label: labelFor(START_MASTERY),
lastSeenMs: 0,
dueAtMs: 0
};
}

function updateItemMastery(attempt) {
if (!attempt) { return null; }
var s = getAdaptiveState();
var key = buildItemKey(attempt);
var item = s.items[key] || freshItem(key, attempt);

item.seen += 1;
item.lastSeenMs = now();
if (attempt.prompt && !item.prompt) { item.prompt = attempt.prompt; }
if (attempt.correct && !item.correct) { item.correct = attempt.correct; }

var isSpeech = attempt.activityType === 'speech';

if (attempt.correct === true || attempt.isCorrect === true) {
item.correctCount += 1;
item.streak += 1;
var streakBonus = Math.min(0.05, item.streak * 0.01);
item.mastery = Math.min(1, item.mastery + 0.10 + streakBonus);
} else {
item.wrongCount += 1;
item.streak = 0;
var penalty = isSpeech ? 0.08 : 0.16;
item.mastery = Math.max(0, item.mastery - penalty);
}

item.label = labelFor(item.mastery);
item.dueAtMs = now() + dueDelayFor(item.label);
s.items[key] = item;
saveAdaptiveState(s);
return item;
}

function recordAdaptiveAttempt(attempt) {
try {
if (!attempt) { return null; }
var s = getAdaptiveState();
var correct = attempt.correct === true || attempt.isCorrect === true;
s.attempts.push({
courseId: attempt.courseId || 'unknown',
lessonId: attempt.lessonId == null ? null : attempt.lessonId,
itemKey: buildItemKey(attempt),
prompt: attempt.prompt || '',
correctAnswer: attempt.correct && attempt.correct !== true ? attempt.correct : (attempt.correctAnswer || ''),
userAnswer: attempt.userAnswer == null ? '' : attempt.userAnswer,
activityType: attempt.activityType || 'quiz',
isCorrect: correct,
ts: now(),
speedMs: attempt.speedMs == null ? null : attempt.speedMs,
hintUsed: !!attempt.hintUsed
});
saveAdaptiveState(s);
var normalized = {
courseId: attempt.courseId,
lessonId: attempt.lessonId,
itemId: attempt.itemId,
prompt: attempt.prompt,
correct: correct,
activityType: attempt.activityType
};
if (attempt.correct && attempt.correct !== true) { normalized.correct = correct; normalized.correctText = attempt.correct; }
return updateItemMastery(normalized);
} catch (e) {
return null;
}
}

function itemsForCourse(courseId) {
var s = getAdaptiveState();
var out = [];
Object.keys(s.items).forEach(function (k) {
var it = s.items[k];
if (!courseId || it.courseId === courseId) { out.push(it); }
});
return out;
}

function getWeakItems(courseId, limit) {
var lim = limit || 5;
var list = itemsForCourse(courseId).filter(function (it) {
return it.label === 'weak' || it.label === 'learning' || it.wrongCount > 0;
});
list.sort(function (a, b) {
if (a.mastery !== b.mastery) { return a.mastery - b.mastery; }
return (b.wrongCount || 0) - (a.wrongCount || 0);
});
return list.slice(0, lim);
}

function getDueReviewItems(courseId, limit) {
var lim = limit || 10;
var t = now();
var list = itemsForCourse(courseId).filter(function (it) {
return it.dueAtMs && it.dueAtMs <= t;
});
list.sort(function (a, b) { return (a.dueAtMs || 0) - (b.dueAtMs || 0); });
return list.slice(0, lim);
}

function getMasteredItems(courseId, limit) {
var lim = limit || 10;
var list = itemsForCourse(courseId).filter(function (it) { return it.label === 'mastered'; });
list.sort(function (a, b) { return (a.lastSeenMs || 0) - (b.lastSeenMs || 0); });
return list.slice(0, lim);
}

function recentAccuracy(courseId, sampleSize) {
var n = sampleSize || 12;
var s = getAdaptiveState();
var recent = s.attempts.filter(function (a) {
return !courseId || a.courseId === courseId;
}).slice(-n);
if (!recent.length) { return null; }
var hits = 0;
recent.forEach(function (a) { if (a.isCorrect) { hits += 1; } });
return hits / recent.length;
}

function getSmartLessonMix(courseId, currentLessonId) {
var acc = recentAccuracy(courseId, 12);
var struggling = acc !== null && acc < 0.6;
var doingWell = acc !== null && acc >= 0.85;
var newTarget = struggling ? 1 : (doingWell ? 3 : 2);
var weak = getWeakItems(courseId, struggling ? 5 : 3);
var older = getMasteredItems(courseId, doingWell ? 3 : 2);
return {
courseId: courseId || null,
currentLessonId: currentLessonId == null ? null : currentLessonId,
recentAccuracy: acc,
mode: struggling ? 'review' : (doingWell ? 'challenge' : 'balanced'),
newWordTarget: newTarget,
weakItems: weak,
olderMasteredItems: older,
allowHarderSentenceBuilding: doingWell,
allowMixedReview: !struggling,
mix: { currentPct: 60, weakPastPct: 25, olderMasteredPct: 15 }
};
}

function isBanglaCourse(courseId) { return courseId === 'bnen'; }

function getSmartPlanMessage(courseId) {
var plan = getSmartLessonMix(courseId, null);
var weakNames = plan.weakItems.map(function (it) {
return (it.correct || it.prompt || '').toString().slice(0, 24);
}).filter(Boolean).slice(0, 3);
var weakList = weakNames.join(', ');
var bn = isBanglaCourse(courseId);
if (plan.recentAccuracy === null) {
return bn
? 'Notun shuru! Aaj olpo kore \u09B6\u09BF\u0996\u09AC\u09CB \u2014 First lesson. Just a few words today.'
: "Fresh start. Today we'll learn a few words and take it slow.";
}
if (plan.mode === 'review') {
var r = bn
? 'Aaj ast\u09C7 ast\u09C7 \u2014 let us slow down and review'
: "Let's slow down today. We'll review";
return weakList ? (r + ' ' + weakList + '.') : (r + ' your weak words.');
}
if (plan.mode === 'challenge') {
return bn
? ('Darun cholchhe! You are doing well. Today: about ' + plan.newWordTarget + ' new words and some review.')
: ('You are doing well. Today has about ' + plan.newWordTarget + ' new words and some review.');
}
return bn
? ('Balanced din. Today: about ' + plan.newWordTarget + ' new words and a little review.')
: ('Nice pace. Today has about ' + plan.newWordTarget + ' new words and a little review.');
}

// --- Screen detection helpers ---

function looksHome(text) {
var t = (text || '').toLowerCase();
return t.indexOf('tiny wins') !== -1 ||
t.indexOf('current path') !== -1 ||
t.indexOf('total xp') !== -1 ||
t.indexOf('course a') !== -1 ||
t.indexOf('course b') !== -1;
}

function looksReview(text) {
var t = (text || '').toLowerCase();
return t.indexOf('review mode') !== -1 ||
t.indexOf('older words come back') !== -1 ||
t.indexOf('spaced repetition') !== -1;
}

function detectLessonId() {
try {
if (window.LanguageAiState && window.LanguageAiState.currentLesson != null) {
return window.LanguageAiState.currentLesson;
}
} catch (e) {}
try {
var raw = localStorage.getItem('language_ai_v1_state');
if (raw) {
var st = JSON.parse(raw);
if (st && st.currentLesson != null) { return st.currentLesson; }
}
} catch (e) {}
return null;
}

function detectCourseId() {
try {
if (window.LanguageAiState && window.LanguageAiState.courseId) { return window.LanguageAiState.courseId; }
} catch (e) {}
try {
var raw = localStorage.getItem('language_ai_v1_state');
if (raw) {
var st = JSON.parse(raw);
if (st && st.courseId) { return st.courseId; }
}
} catch (e) {}
return 'bnen';
}

function esc(s) {
return String(s == null ? '' : s)
.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderSmartPlanCard(courseId) {
var mount = document.getElementById('adaptiveSmartPlan');
if (!mount) { return; }
var cid = courseId || detectCourseId();
var msg = getSmartPlanMessage(cid);
mount.innerHTML =
'<div class="card stack adaptive-card">' +
'<div class="eyebrow">Today\'s Smart Plan</div>' +
'<p class="lead">' + esc(msg) + '</p>' +
'</div>';
}

function renderWeakWordsCard(courseId) {
var mount = document.getElementById('adaptiveWeakWords');
if (!mount) { return; }
var cid = courseId || detectCourseId();
var weak = getWeakItems(cid, 5);
if (!weak.length) {
mount.innerHTML =
'<div class="card stack adaptive-card">' +
'<div class="eyebrow">Weak Words</div>' +
'<p class="lead">No weak words yet. Keep practicing!</p>' +
'</div>';
return;
}
var rows = weak.map(function (it) {
var text = it.correct || it.prompt || '';
return '<article class="card stack">' +
'<h1>' + esc(text) + '</h1>' +
'<p class="lead">' + esc(it.prompt || '') + '</p>' +
'<div class="audio-row">' +
'<button class="small-action" data-adaptive-speak="' + esc(text) + '">\uD83D\uDD0A Hear</button>' +
'<button class="small-action" data-adaptive-retry="' + esc(it.key) + '">Retry</button>' +
'</div></article>';
}).join('');
mount.innerHTML =
'<div class="card stack adaptive-card">' +
'<div class="eyebrow">Weak Words</div>' +
'<p class="lead">Your weakest 5 for this course.</p>' + rows +
'</div>';
wireWeakWordButtons(mount, cid);
}

function wireWeakWordButtons(root, courseId) {
if (!root) { return; }
root.querySelectorAll('[data-adaptive-speak]').forEach(function (b) {
b.addEventListener('click', function () {
var text = b.getAttribute('data-adaptive-speak');
try {
if ('speechSynthesis' in window) {
var u = new SpeechSynthesisUtterance(text);
u.lang = courseId === 'enes' ? 'es-ES' : 'en-US';
speechSynthesis.cancel();
speechSynthesis.speak(u);
}
} catch (e) {}
});
});
root.querySelectorAll('[data-adaptive-retry]').forEach(function (b) {
b.addEventListener('click', function () {
try { window.location.hash = '#review'; } catch (e) {}
});
});
}

function renderAdaptiveUI(courseId) {
renderSmartPlanCard(courseId);
renderWeakWordsCard(courseId);
}

function adaptiveProgressSummary(courseId) {
var cid = courseId || detectCourseId();
var s = getAdaptiveState();
return {
adaptiveSchemaVersion: SCHEMA_VERSION,
recentAccuracy: recentAccuracy(cid, 12),
weakCount: getWeakItems(cid, 999).length,
totalTrackedItems: Object.keys(s.items).length,
updatedAtMs: s.updatedAtMs
};
}

// --- Self-Hookup Boot System (V5.2.1) ---

var IGNORED_SELECTORS = [
'.bottom-nav',
'.drawer',
'.topbar',
'#adaptiveSmartPlan',
'#adaptiveWeakWords'
];

function simpleHash(s) {
var h = 0;
for (var i = 0; i < s.length; i++) {
h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
}
return h;
}

function inferActivityType(el, screenText) {
var id = el.id || '';
var t = (screenText || '').toLowerCase();
if (id === 'recordBtn' || id === 'saidBtn' ||
t.indexOf('pronunciation') !== -1 || t.indexOf('speaking') !== -1) {
return 'speech';
}
if (id === 'checkBtn' ||
t.indexOf('build here') !== -1 || t.indexOf('perfect sentence') !== -1) {
return 'sentence-build';
}
if (el.classList.contains('memory-card') ||
t.indexOf('tap two cards') !== -1 || t.indexOf('memory') !== -1) {
return 'match';
}
if (el.hasAttribute('data-master') || looksReview(t)) {
return 'review';
}
if (t.indexOf('boss') !== -1 || t.indexOf('speed') !== -1) {
return 'quiz';
}
return 'tap';
}

function extractPrompt(el) {
var card = el.closest('.card, .question-card, .tile-card, [data-card], .screen-section') || el.parentElement;
if (!card) { return ''; }
var h = card.querySelector('h1, h2, h3, .prompt, .question, .target-word, .word-display');
if (h) { return (h.textContent || '').trim(); }
return (card.textContent || '').trim().slice(0, 80);
}

function getFeedbackText() {
var fb = document.querySelector(
'#feedback, .feedback, .result-text, .answer-result, .toast, [data-feedback]'
);
return fb ? (fb.textContent || '').trim() : '';
}

function inferCorrectness(el, feedbackText) {
var fb = (feedbackText || '').toLowerCase();
var classes = el.className || '';
if (classes.indexOf('good') !== -1 || classes.indexOf('done') !== -1) { return true; }
if (el.hasAttribute('data-master')) { return true; }
if (el.id === 'saidBtn') { return true; }
if (fb.indexOf('correct') !== -1 || fb.indexOf('perfect') !== -1 ||
fb.indexOf('matched') !== -1 || fb.indexOf('nice') !== -1 ||
fb.indexOf('great') !== -1) { return true; }
if (classes.indexOf('bad') !== -1) { return false; }
if (fb.indexOf('not yet') !== -1 || fb.indexOf('try again') !== -1 ||
fb.indexOf('target:') !== -1 || fb.indexOf('correct:') !== -1 ||
fb.indexOf('close') !== -1 || fb.indexOf('wrong') !== -1) { return false; }
return null;
}

function ensureMount(id, screen) {
if (document.getElementById(id)) { return; }
var hero = screen.querySelector(
'.hero, .screen-hero, .hero-section, .top-card, h1, h2'
);
var div = document.createElement('div');
div.id = id;
if (hero && hero.parentNode) {
hero.parentNode.insertBefore(div, hero.nextSibling);
} else {
screen.insertBefore(div, screen.firstChild);
}
}

var _lastAttemptKey = '';
var _lastAttemptTs = 0;
var _pointerDownTs = 0;

function isInIgnoredZone(el) {
return IGNORED_SELECTORS.some(function (sel) {
return el.closest(sel) !== null;
});
}

function handleDocumentClick(e) {
var el = e.target;
if (!el) { return; }
if (isInIgnoredZone(el)) { return; }
var matched =
el.classList.contains('choice') ||
el.classList.contains('memory-card') ||
el.classList.contains('tile') ||
el.hasAttribute('data-answer') ||
el.hasAttribute('data-master') ||
el.hasAttribute('data-tile') ||
el.id === 'checkBtn' ||
el.id === 'saidBtn' ||
el.id === 'recordBtn';
if (!matched) { return; }
var clickTs = now();
var speed = _pointerDownTs > 0 ? (clickTs - _pointerDownTs) : null;
setTimeout(function () {
try {
var screen = document.getElementById('screen');
var screenText = screen ? (screen.textContent || '') : '';
var fbText = getFeedbackText();
var correctness = inferCorrectness(el, fbText);
if (correctness === null) { return; }
var courseId = detectCourseId();
var lessonId = detectLessonId();
var actType = inferActivityType(el, screenText);
var prompt = extractPrompt(el);
var userAns = '';
if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
userAns = el.value || '';
} else {
userAns = (el.textContent || el.getAttribute('data-answer') || el.getAttribute('data-tile') || '').trim();
}
var correctAns = el.getAttribute('data-correct') || el.getAttribute('data-answer') || '';
if (!correctAns) {
var revealed = document.querySelector('.correct-answer, [data-correct-text], .answer-reveal');
correctAns = revealed ? (revealed.textContent || '').trim() : '';
}
var itemId = courseId + '-' + lessonId + '-' + normalizeText(prompt).slice(0, 40) + '-' + actType;
var itemKey = String(simpleHash(itemId));
if (itemKey === _lastAttemptKey && (clickTs - _lastAttemptTs) < 600) { return; }
_lastAttemptKey = itemKey;
_lastAttemptTs = clickTs;
recordAdaptiveAttempt({
courseId: courseId,
lessonId: lessonId,
itemId: itemId,
prompt: prompt,
correct: correctness,
correctAnswer: correctAns,
userAnswer: userAns,
activityType: actType,
speedMs: speed,
hintUsed: false
});
try { renderAdaptiveUI(courseId); } catch (e2) {}
} catch (e) {}
}, 150);
}

function handlePointerDown() { _pointerDownTs = now(); }

function syncScreenMounts() {
try {
var screen = document.getElementById('screen');
if (!screen) { return; }
var text = screen.textContent || '';
if (looksHome(text)) {
ensureMount('adaptiveSmartPlan', screen);
renderAdaptiveUI(detectCourseId());
} else if (looksReview(text)) {
ensureMount('adaptiveWeakWords', screen);
renderAdaptiveUI(detectCourseId());
}
} catch (e) {}
}

function boot() {
try {
if (!localStorage.getItem(ADAPTIVE_KEY)) { saveAdaptiveState(freshAdaptiveState()); }
} catch (e) {}
try {
var screen = document.getElementById('screen');
if (screen) {
var observer = new MutationObserver(function () { syncScreenMounts(); });
observer.observe(screen, { childList: true, subtree: true, characterData: true });
}
} catch (e) {}
try {
document.addEventListener('click', handleDocumentClick, true);
document.addEventListener('pointerdown', handlePointerDown, true);
} catch (e) {}
try { syncScreenMounts(); } catch (e) {}
try { renderAdaptiveUI(detectCourseId()); } catch (e) {}
}

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', boot);
} else {
boot();
}

// Public API
window.LanguageAiAdaptive = {
getAdaptiveState: getAdaptiveState,
saveAdaptiveState: saveAdaptiveState,
recordAdaptiveAttempt: recordAdaptiveAttempt,
updateItemMastery: updateItemMastery,
getWeakItems: getWeakItems,
getDueReviewItems: getDueReviewItems,
getSmartLessonMix: getSmartLessonMix,
getSmartPlanMessage: getSmartPlanMessage,
renderAdaptiveUI: renderAdaptiveUI,
adaptiveProgressSummary: adaptiveProgressSummary,
version: 'V5.2.1 Adaptive Self-Hookup'
};

})();
