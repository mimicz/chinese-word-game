// 字字千金 Service Worker
// 採 cache-first 策略：靜態資源優先讀 cache，失敗才打網路
// 每次發版前需 bump CACHE_VERSION
const CACHE_VERSION = 'zzqj-v2';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './register-sw.js',
  './data/jiangcuo.js',
  './data/zizhu.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './qrcode.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
