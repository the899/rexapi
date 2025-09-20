const CACHE_NAME = 'radio-cache-v6';
const urlsToCache = [
    '/radio/',
    '/radio/index.html',
    '/radio/config.json',
    '/radio/manifest.json',
    '/radio/icon.png'
];

// 安装 Service Worker，缓存关键资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: 缓存已打开');
                return cache.addAll(urlsToCache);
            })
    );
});

// 激活 Service Worker，清理旧缓存
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

// 拦截网络请求，优先从缓存返回，处理重定向
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    // 检查缓存响应是否包含重定向
                    if (response.redirected) {
                        console.log('Service Worker: 检测到缓存重定向，重建响应');
                        // 重建响应以剥离重定向标志，兼容 Safari PWA
                        return new Response(response.body, {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }
                    console.log('Service Worker: 从缓存返回', event.request.url);
                    return response;
                }
                // 若缓存未命中，发起网络请求
                return fetch(event.request)
                    .then(networkResponse => {
                        // 缓存新响应（仅对 GET 请求）
                        if (networkResponse.ok && event.request.method === 'GET') {
                            return caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, networkResponse.clone());
                                    return networkResponse;
                                });
                        }
                        return networkResponse;
                    });
            })
            .catch(err => {
                console.error('Service Worker: 获取资源失败', err);
                // 返回离线提示（可选）
                return new Response('网络不可用，请检查连接', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});