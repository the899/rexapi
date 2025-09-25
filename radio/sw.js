// 定义缓存名称
const CACHE_NAME = 'radio-cache-v8';
// 定义需要缓存的资源
const urlsToCache = [
    '/radio/',
    '/radio/index.html',
    '/radio/radio.css',
    '/radio/radio.js',
    '/radio/icon.png'
];

// 安装 Service Worker，缓存资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache); // 缓存所有指定资源
            })
    );
});

// 拦截网络请求，优先使用缓存
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request); // 返回缓存或发起网络请求
            })
    );
});

// 激活 Service Worker，清理旧缓存
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName); // 删除非当前版本的缓存
                    }
                })
            );
        })
    );
});
