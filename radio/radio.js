// 注册 Service Worker，支持离线缓存
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/radio/sw.js'); // 注册 sw.js
        // console.log('Service Worker registered');
    });
}

// 获取 DOM 元素
const radioGrid = document.querySelector('.radio-grid'); // 频道卡牌容器
const player = document.getElementById('radio-player'); // 音频播放器
let currentCard = null; // 当前选中的卡牌
let retryTimeout = null; // 重试定时器
let retryCount = 0; // 播放重试计数
const maxRetries = 5; // 最大播放重试次数
let isUserPaused = false; // 用户是否手动暂停
let playCheckInterval = null; // 播放状态检查定时器
let hasUserInteracted = false; // 是否有用户交互
let scrollTimeout = null; // 防抖定时器

// 滚动到卡牌所在行的屏幕中间（横屏和竖屏）
function scrollToCardRow(targetCard) {
    if (scrollTimeout) clearTimeout(scrollTimeout); // 清除现有防抖定时器
    scrollTimeout = setTimeout(() => {
        const cardRect = targetCard.getBoundingClientRect();
        // 动态获取卡牌尺寸
        const rootStyles = getComputedStyle(document.documentElement);
        const isMacOS = window.matchMedia('(min-width: 1024px)').matches;
        const cardSize = parseFloat(rootStyles.getPropertyValue(isMacOS ? '--card-size-macos' : '--card-size-iphone').trim()) || 130;
        const gridStyles = getComputedStyle(radioGrid);
        const gridGap = parseFloat(gridStyles.getPropertyValue('gap').trim()) || 12;

        // 计算行高
        const itemHeight = cardSize + gridGap; // 每行高度（卡牌高度 + 间距）
        const cardTop = targetCard.offsetTop; // 卡牌顶部相对于网格的偏移
        const rowTop = Math.floor(cardTop / itemHeight) * itemHeight; // 所在行顶部
        const rowCenter = rowTop + (cardSize / 2); // 行中心点

        // 获取视口尺寸，考虑安全区域
        const safeAreaTop = parseFloat(rootStyles.getPropertyValue('--safe-area-inset').trim()) || 16;
        const safeAreaBottom = parseFloat(rootStyles.getPropertyValue('--safe-area-inset').trim()) || 16;
        const viewportHeight = window.innerHeight - safeAreaTop - safeAreaBottom;

        // 计算滚动目标（垂直方向滚动到行中心）
        const scrollTarget = rowCenter - (viewportHeight / 2);
        const maxScrollY = radioGrid.scrollHeight - viewportHeight;
        const scrollY = Math.max(0, Math.min(scrollTarget, maxScrollY));

        window.scrollTo({
            top: scrollY + safeAreaTop, // 调整安全区域偏移
            behavior: 'smooth'
        });
        // console.log(`Scrolled to card at row center: ${scrollY}px`);
    }, 100); // 防抖 100ms
}

// 加载频道列表
async function loadChannels(maxRetries = 3, retryDelay = 3000) {
    let attempts = 0; // 重试计数
    async function tryFetchConfig() {
        try {
            radioGrid.innerHTML = ''; // 清空网格
            const response = await fetch('https://www.a1b2.cc/radio.json', { cache: 'no-cache' });
            if (!response.ok) {
                throw new Error(`HTTP 错误，状态码：${response.status}`);
            }
            const channels = await response.json();
            if (!channels || typeof channels !== 'object') {
                throw new Error('radio.json 格式错误：无效的 JSON 对象');
            }
            // 创建频道卡牌
            const channelNames = Object.keys(channels);
            channelNames.forEach((name) => {
                const card = document.createElement('div');
                card.className = 'radio-card';
                card.dataset.stream = channels[name];
                const span = document.createElement('span');
                span.textContent = name;
                card.appendChild(span);
                radioGrid.appendChild(card);
            });

            // 创建“重置应用”卡牌
            const resetCard = document.createElement('div');
            resetCard.className = 'radio-card';
            resetCard.dataset.reset = 'true';
            const resetSpan = document.createElement('span');
            resetSpan.textContent = '重置应用';
            resetCard.appendChild(resetSpan);
            radioGrid.appendChild(resetCard);

            // 为卡牌添加点击事件
            const cards = document.querySelectorAll('.radio-card');
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    if (card.dataset.reset === 'true') {
                        if (confirm('确定要重置应用吗？这将清除所有缓存和播放状态，并加载最新频道列表。')) {
                            resetApp();
                        }
                    } else {
                        const streamUrl = card.dataset.stream;
                        if (currentCard === card) {
                            if (!player.paused) {
                                player.pause();
                                card.dataset.status = 'paused';
                                isUserPaused = true;
                                localStorage.setItem('lastStatus', 'paused');
                            } else {
                                isUserPaused = false;
                                retryCount = 0;
                                retryPlay(card, streamUrl);
                            }
                            scrollToCardRow(card);
                        } else {
                            cards.forEach(c => {
                                if (c.dataset.reset !== 'true') {
                                    c.classList.remove('selected');
                                    c.dataset.status = '';
                                }
                            });
                            card.classList.add('selected');
                            currentCard = card;
                            localStorage.setItem('lastStream', streamUrl);
                            localStorage.setItem('lastStatus', 'playing');
                            isUserPaused = false;
                            retryCount = 0;
                            retryPlay(card, streamUrl);
                            scrollToCardRow(card);
                        }
                        hasUserInteracted = true;
                    }
                });
            });
            // console.log(`Loaded ${channelNames.length} channels`);
        } catch (err) {
            // console.error(`Failed to load channels: ${err.message}`);
            attempts++;
            if (attempts < maxRetries) {
                setTimeout(tryFetchConfig, retryDelay);
            } else {
                radioGrid.innerHTML = `<p style="text-align: center; padding: 20px;">文件加载错误，请重试</p>`;
                const resetCard = document.createElement('div');
                resetCard.className = 'radio-card';
                resetCard.dataset.reset = 'true';
                const resetSpan = document.createElement('span');
                resetSpan.textContent = '重置应用';
                resetCard.appendChild(resetSpan);
                radioGrid.appendChild(resetCard);
                resetCard.addEventListener('click', () => {
                    if (confirm('确定要重置应用吗？这将清除所有缓存和播放状态，并加载最新频道列表。')) {
                        resetApp();
                    }
                });
            }
        }
    }
    tryFetchConfig();
}

// 播放电台流，支持重试
function retryPlay(targetCard, streamUrl) {
    const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (playCheckInterval) clearInterval(playCheckInterval);

    if (player.src === streamUrl && !player.paused && player.currentTime > 0 && player.readyState >= 2) {
        targetCard.dataset.status = 'playing';
        isUserPaused = false;
        retryCount = 0;
        // console.log(`Already playing: ${streamUrl}`);
        return;
    }

    if (retryCount >= maxRetries) {
        targetCard.dataset.status = 'error';
        // console.error(`Max retries reached for ${streamUrl}`);
        return;
    }

    targetCard.dataset.status = 'connecting';
    if (player.src !== streamUrl) {
        player.src = streamUrl;
    }

    player.play().then(() => {
        playCheckInterval = setInterval(() => {
            if (!player.paused && player.currentTime > 0 && player.readyState >= 2) {
                targetCard.dataset.status = 'playing';
                isUserPaused = false;
                localStorage.setItem('lastStatus', 'playing');
                retryCount = 0;
                clearInterval(playCheckInterval);
                if (retryTimeout) clearTimeout(retryTimeout);
                // console.log(`Playing: ${streamUrl}`);
            }
        }, 500);
    }).catch((err) => {
        targetCard.dataset.status = 'error';
        retryCount++;
        // console.error(`Play error: ${err.message}`);
        if (retryCount < maxRetries) {
            retryTimeout = setTimeout(() => retryPlay(targetCard, streamUrl), retryInterval);
        }
    });

    setTimeout(() => {
        if (player.paused && targetCard.dataset.status === 'connecting' && player.readyState < 2) {
            targetCard.dataset.status = 'error';
            retryCount++;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(targetCard, streamUrl), retryInterval);
            }
        }
    }, 10000);
}

// 处理用户交互，恢复错误状态的播放
function handleUserInteraction() {
    if (!hasUserInteracted && currentCard && currentCard.dataset.status === 'error') {
        hasUserInteracted = true;
        retryCount = 0;
        retryPlay(currentCard, currentCard.dataset.stream);
        // console.log('Retrying playback due to user interaction');
    }
}
document.addEventListener('click', handleUserInteraction, { once: true });
document.addEventListener('touchstart', handleUserInteraction, { once: true });
document.addEventListener('keydown', handleUserInteraction, { once: true });

// 重置应用，清除状态和缓存
async function resetApp() {
    try {
        player.pause();
        player.src = '';
        const cards = document.querySelectorAll('.radio-card');
        cards.forEach(card => {
            if (card.dataset.reset !== 'true') {
                card.classList.remove('selected');
                card.dataset.status = '';
            }
        });
        currentCard = null;
        localStorage.clear();
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }
        }
        await loadChannels();
        // console.log('App reset successfully');
    } catch (err) {
        alert('重置应用失败，请检查网络或联系支持团队。');
        // console.error(`Reset failed: ${err.message}`);
    }
}

// 初始化加载频道
loadChannels();

// 设置 Media Session，支持后台播放控制
if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
        title: '听音悦台',
        artist: 'CRI',
        album: 'Online Radio'
    });
    navigator.mediaSession.setActionHandler('play', () => {
        if (currentCard) {
            isUserPaused = false;
            retryCount = 0;
            retryPlay(currentCard, currentCard.dataset.stream);
            scrollToCardRow(currentCard);
        }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        if (currentCard) {
            player.pause();
            currentCard.dataset.status = 'paused';
            isUserPaused = true;
            localStorage.setItem('lastStatus', 'paused');
            scrollToCardRow(currentCard);
        }
    });
}

// 音频播放器事件监听
player.addEventListener('waiting', () => {
    if (currentCard && player.src) {
        currentCard.dataset.status = 'connecting';
    }
});
player.addEventListener('playing', () => {
    if (currentCard && player.src && !player.paused && player.currentTime > 0 && player.readyState >= 2) {
        currentCard.dataset.status = 'playing';
        isUserPaused = false;
        localStorage.setItem('lastStatus', 'playing');
        retryCount = 0;
        if (retryTimeout) clearTimeout(retryTimeout);
        if (playCheckInterval) clearInterval(playCheckInterval);
    }
});
player.addEventListener('pause', () => {
    if (currentCard && player.src && isUserPaused) {
        currentCard.dataset.status = 'paused';
        localStorage.setItem('lastStatus', 'paused');
    }
});
player.addEventListener('error', () => {
    if (currentCard && player.src) {
        if (player.paused && player.readyState < 2) {
            currentCard.dataset.status = 'error';
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
            }
        }
    }
});
player.addEventListener('stalled', () => {
    if (currentCard && player.src) {
        if (player.paused && player.readyState < 2) {
            currentCard.dataset.status = 'error';
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
            }
        }
    }
});
player.addEventListener('suspend', () => {
    if (currentCard && player.src) {
        if (player.paused && player.readyState < 2) {
            currentCard.dataset.status = 'error';
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
            }
        }
    }
});