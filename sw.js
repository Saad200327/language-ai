/**
 * Language Ai V5 — Service Worker
 * Provides basic offline caching for the app shell.
 */

const CACHE_NAME = 'language-ai-v5';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './firebase-backend.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for Firebase API calls, cache-first for app shell
  if (event.request.url.includes('firebasejs') || event.request.url.includes('googleapis')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
