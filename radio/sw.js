const CACHE_NAME = 'radio-cache-v1';
const urlsToCache = [
    '/radio/',
    '/radio/index.html',
    '/radio/manifest.json',
    '/radio/icon.png',
    '/radio/images/poster1.png',
    '/radio/images/poster2.png',
    '/radio/images/poster3.png',
    '/radio/images/poster4.png',
    '/radio/images/poster5.png',
    '/radio/images/poster6.png',
    '/radio/images/poster7.png',
    '/radio/images/poster8.png',
    '/radio/images/poster9.png'
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