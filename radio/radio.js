// 注册 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/radio/sw.js');
    });
}

// 获取 DOM 元素
const radioGrid = document.querySelector('.radio-grid');
const player = document.getElementById('radio-player');
let currentCard = null;
let retryTimeout = null;
let retryCount = 0;
const maxRetries = 5;
let isUserPaused = false;
let playCheckInterval = null;
let scrollTimeout = null;

// 动态设置网格最大宽度以确保居中
function setGridMaxWidth() {
    const rootStyles = getComputedStyle(document.documentElement);
    const isPC = window.matchMedia('(min-width: 1024px)').matches;
    const isIOS = window.matchMedia('(-webkit-device-pixel-ratio)').matches;
    const cardSize = parseFloat(rootStyles.getPropertyValue(
        isPC ? '--card-size-pc' : isIOS ? '--card-size-ios' : '--card-size-mobile'
    ).trim()) || 100;
    const windowWidth = window.innerWidth - 
        parseFloat(rootStyles.getPropertyValue('env(safe-area-inset-left, 0)').trim()) -
        parseFloat(rootStyles.getPropertyValue('env(safe-area-inset-right, 0)').trim());
    const columns = Math.floor(windowWidth / cardSize);
    const maxWidth = columns * cardSize;
    radioGrid.style.maxWidth = `${maxWidth}px`;
}

// 滚动到卡牌所在行的屏幕中间
function scrollToCardRow(targetCard) {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        const rootStyles = getComputedStyle(document.documentElement);
        const isPC = window.matchMedia('(min-width: 1024px)').matches;
        const isIOS = window.matchMedia('(-webkit-device-pixel-ratio)').matches;
        const cardSize = parseFloat(rootStyles.getPropertyValue(
            isPC ? '--card-size-pc' : isIOS ? '--card-size-ios' : '--card-size-mobile'
        ).trim()) || 100;
        const cardTop = targetCard.offsetTop;
        const rowTop = Math.floor(cardTop / cardSize) * cardSize;
        const rowCenter = rowTop + (cardSize / 2);
        const safeAreaTop = parseFloat(rootStyles.getPropertyValue('--safe-area-inset').trim()) || 16;
        const safeAreaBottom = parseFloat(rootStyles.getPropertyValue('--safe-area-inset').trim()) || 16;
        const viewportHeight = window.innerHeight - safeAreaTop - safeAreaBottom;
        const scrollTarget = rowCenter - (viewportHeight / 2);
        const maxScrollY = radioGrid.scrollHeight > viewportHeight ? radioGrid.scrollHeight - viewportHeight : 0;
        const scrollY = Math.max(0, Math.min(scrollTarget, maxScrollY));

        window.scrollTo({
            top: scrollY + safeAreaTop,
            behavior: 'smooth'
        });
    }, 100);
}

// 动态调整滚动位置和网格宽度
window.addEventListener('resize', () => {
    setGridMaxWidth();
    if (currentCard) scrollToCardRow(currentCard);
});

// 监听横竖屏切换
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        setGridMaxWidth();
        if (currentCard) scrollToCardRow(currentCard);
    }, 100); // 延迟确保屏幕尺寸更新
});

// 加载频道列表（动态加载 radio.json 中的所有频道 + 1 个重置卡牌）
async function loadChannels(maxRetries = 3, retryDelay = 3000) {
    let attempts = 0;
    async function tryFetchConfig() {
        try {
            radioGrid.innerHTML = '';
            const response = await fetch('https://www.a1b2.cc/radio.json', { cache: 'no-cache' });
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const channels = await response.json();
            if (!channels || typeof channels !== 'object') throw new Error('Invalid JSON');

            // 加载所有频道
            Object.keys(channels).forEach(name => {
                const card = document.createElement('div');
                card.className = 'radio-card';
                card.dataset.stream = channels[name];
                card.innerHTML = `<span>${name}</span>`;
                radioGrid.appendChild(card);
            });

            // 添加重置应用卡牌
            const resetCard = document.createElement('div');
            resetCard.className = 'radio-card';
            resetCard.dataset.reset = 'true';
            resetCard.innerHTML = '<span>重置应用</span>';
            radioGrid.appendChild(resetCard);

            setGridMaxWidth();

            document.querySelectorAll('.radio-card').forEach(card => {
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
                        } else {
                            document.querySelectorAll('.radio-card').forEach(c => {
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
                        }
                        scrollToCardRow(card);
                    }
                });
            });
        } catch (err) {
            attempts++;
            if (attempts < maxRetries) {
                setTimeout(tryFetchConfig, retryDelay);
            } else {
                radioGrid.innerHTML = '<p style="text-align: center; padding: 20px;">文件加载错误，请重试</p>';
                const resetCard = document.createElement('div');
                resetCard.className = 'radio-card';
                resetCard.dataset.reset = 'true';
                resetCard.innerHTML = '<span>重置应用</span>';
                radioGrid.appendChild(resetCard);
                setGridMaxWidth();
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

// 播放电台流
function retryPlay(targetCard, streamUrl) {
    const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
    if (retryTimeout) clearTimeout(retryTimeout);
    if (playCheckInterval) clearInterval(playCheckInterval);

    if (player.src === streamUrl && !player.paused && player.currentTime > 0 && player.readyState >= 2) {
        targetCard.dataset.status = 'playing';
        isUserPaused = false;
        retryCount = 0;
        return;
    }

    if (retryCount >= maxRetries) {
        targetCard.dataset.status = 'error';
        return;
    }

    targetCard.dataset.status = 'connecting';
    if (player.src !== streamUrl) player.src = streamUrl;

    player.play().then(() => {
        playCheckInterval = setInterval(() => {
            if (!player.paused && player.currentTime > 0 && player.readyState >= 2) {
                targetCard.dataset.status = 'playing';
                isUserPaused = false;
                localStorage.setItem('lastStatus', 'playing');
                retryCount = 0;
                clearInterval(playCheckInterval);
                if (retryTimeout) clearTimeout(retryTimeout);
            } else if (player.paused && player.readyState < 2) {
                targetCard.dataset.status = 'error';
                retryCount++;
                if (retryCount < maxRetries) {
                    retryTimeout = setTimeout(() => retryPlay(targetCard, streamUrl), retryInterval);
                }
            }
        }, 1000);
    }).catch(() => {
        targetCard.dataset.status = 'error';
        retryCount++;
        if (retryCount < maxRetries) {
            retryTimeout = setTimeout(() => retryPlay(targetCard, streamUrl), retryInterval);
        }
    });
}

// 重置应用
async function resetApp() {
    try {
        player.pause();
        player.src = '';
        document.querySelectorAll('.radio-card').forEach(card => {
            if (card.dataset.reset !== 'true') {
                card.classList.remove('selected');
                card.dataset.status = '';
            }
        });
        currentCard = null;
        localStorage.clear();
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) await registration.unregister();
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) await caches.delete(cacheName);
            }
        }
        await loadChannels();
    } catch (err) {
        alert('重置应用失败，请检查网络或联系支持团队。');
    }
}

// 初始化加载频道
loadChannels();

// 设置 Media Session
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
    if (currentCard && player.src) currentCard.dataset.status = 'connecting';
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
    if (currentCard && player.src && player.paused && player.readyState < 2) {
        currentCard.dataset.status = 'error';
        retryCount++;
        const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
        if (retryCount < maxRetries) {
            retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
        }
    }
});