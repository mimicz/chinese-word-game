// 字字千金 Service Worker
// 靜態資源:cache-first
// /api/*  :network-only (絕不快取後端動態資料)
// 每次發版前需 bump CACHE_VERSION
const CACHE_VERSION = 'zzqj-v9';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './api.js',
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

  // API 與 admin 頁:network-only,不進 cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) {
    return; // 不攔截,瀏覽器走預設 fetch
  }

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
