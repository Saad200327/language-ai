const APP_CACHE_VERSION = 'v5.2.1-adaptive-self-hookup';
const CACHE = `language-ai-${APP_CACHE_VERSION}`;
const ASSETS = [
'./',
'./index.html',
'./styles.css',
'./app.js',
'./adaptive-engine.js',
'./firebase-backend.js',
'./manifest.webmanifest'
];
self.addEventListener('install', event => {
event.waitUntil(
caches.open(CACHE)
.then(cache => cache.addAll(ASSETS))
.then(() => self.skipWaiting())
);
});
self.addEventListener('activate', event => {
event.waitUntil(
caches.keys()
.then(keys =>
Promise.all(
keys
.filter(key => key.startsWith('language-ai-') && key !== CACHE)
.map(key => caches.delete(key))
)
)
.then(() => self.clients.claim())
);
});
self.addEventListener('fetch', event => {
if (event.request.method !== 'GET') return;
const url = new URL(event.request.url);
if (url.origin !== self.location.origin) return;
if (event.request.mode === 'navigate') {
event.respondWith(
fetch(event.request)
.then(response => {
const copy = response.clone();
caches.open(CACHE).then(cache => cache.put('./index.html', copy));
return response;
})
.catch(() => caches.match('./index.html'))
);
return;
}
event.respondWith(
fetch(event.request)
.then(response => {
if (!response || response.status !== 200) return response;
const copy = response.clone();
caches.open(CACHE).then(cache => cache.put(event.request, copy));
return response;
})
.catch(() => caches.match(event.request))
);
});
