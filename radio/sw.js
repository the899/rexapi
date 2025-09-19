const CACHE_NAME = 'radio-cache-v1';

const urlsToCache = [
    '/radio/',
    '/radio/index.html',
    '/radio/manifest.json',
    '/radio/config.json',
    '/radio/icon.png'
];

// 安装 Service Worker 并缓存资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// 激活 Service Worker 并清理旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});

// 拦截网络请求并提供缓存内容
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});