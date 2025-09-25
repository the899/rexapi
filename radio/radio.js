// 注册 Service Worker，支持离线缓存
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/radio/sw.js'); // 注册 sw.js
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

// 滚动到卡牌所在行的屏幕中间（横屏和竖屏）
function scrollToCardRow(card) {
    const cardRect = card.getBoundingClientRect();
    // 动态获取卡牌尺寸（--card-size-iphone, --card-size 或 --card-size-mobile）
    const rootStyles = getComputedStyle(document.documentElement);
    const cardSizeIphone = parseFloat(rootStyles.getPropertyValue('--card-size-iphone').trim()) || 180;
    const cardSize = parseFloat(rootStyles.getPropertyValue('--card-size').trim()) || 150;
    const cardSizeMobile = parseFloat(rootStyles.getPropertyValue('--card-size-mobile').trim()) || 100;
    
    // 判断是否为 iPhone 13（竖屏或横屏）
    const isIphonePortrait = window.matchMedia('(min-width: 375px) and (max-width: 414px) and (orientation: portrait)').matches;
    const isIphoneLandscape = window.matchMedia('(min-width: 667px) and (max-width: 844px) and (orientation: landscape)').matches;
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    const cardHeight = isIphonePortrait || isIphoneLandscape ? cardSizeIphone : (isMobile ? cardSizeMobile : cardSize);
    
    // 获取网格 gap（iPhone 13: 16px，移动端: 12px，横屏: 15px，非移动端: 20px）
    const gridStyles = getComputedStyle(radioGrid);
    const gridGap = parseFloat(gridStyles.getPropertyValue('gap').trim()) || 
                    ((isIphonePortrait || isIphoneLandscape) ? 16 : 
                    (isMobile ? 12 : (window.matchMedia('(orientation: landscape)').matches ? 15 : 20)));
    
    const rowHeight = cardHeight + gridGap; // 每行高度（卡牌高度 + 间距）
    const cardTop = card.offsetTop; // 卡牌顶部相对于网格的偏移
    const rowTop = Math.floor(cardTop / rowHeight) * rowHeight; // 所在行顶部
    const rowCenter = rowTop + (cardHeight / 2); // 行中心点

    // 获取视口高度，考虑安全区域
    const safeAreaTop = parseFloat(rootStyles.getPropertyValue('padding-top').trim()) || 0;
    const safeAreaBottom = parseFloat(rootStyles.getPropertyValue('padding-bottom').trim()) || 0;
    const viewportHeight = window.innerHeight - safeAreaTop - safeAreaBottom;
    const scrollTarget = rowCenter - (viewportHeight / 2); // 行中心对齐屏幕中间

    // 确保滚动不超出网格边界
    const gridRect = radioGrid.getBoundingClientRect();
    const maxScroll = radioGrid.scrollHeight - viewportHeight;
    const scrollY = Math.max(0, Math.min(scrollTarget, maxScroll));

    // 平滑滚动到目标位置
    window.scrollTo({
        top: scrollY + safeAreaTop, // 调整安全区域偏移
        behavior: 'smooth'
    });
}

// 加载频道列表
async function loadChannels(maxRetries = 3, retryDelay = 3000) {
    let attempts = 0; // 重试计数
    async function tryFetchConfig() {
        try {
            radioGrid.innerHTML = ''; // 清空网格
            // 加载 radio.json，禁用缓存
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
                card.dataset.stream = channels[name]; // 设置流地址
                const span = document.createElement('span');
                span.textContent = name; // 设置频道名称
                card.appendChild(span);
                radioGrid.appendChild(card);
            });

            // 创建“重置应用”卡牌
            const resetCard = document.createElement('div');
            resetCard.className = 'radio-card';
            resetCard.dataset.reset = 'true'; // 标记为重置卡牌
            const resetSpan = document.createElement('span');
            resetSpan.textContent = '重置应用';
            resetCard.appendChild(resetSpan);
            radioGrid.appendChild(resetCard);

            // 为卡牌添加点击事件
            const cards = document.querySelectorAll('.radio-card');
            cards.forEach(card => {
                card.addEventListener('click', () => {
                    if (card.dataset.reset === 'true') {
                        // 重置应用：弹出确认框
                        if (confirm('确定要重置应用吗？这将清除所有缓存和播放状态，并加载最新频道列表。')) {
                            resetApp();
                        }
                    } else {
                        const streamUrl = card.dataset.stream; // 获取流地址
                        if (currentCard === card) {
                            // 当前卡牌：切换播放/暂停
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
                            scrollToCardRow(card); // 滚动到卡牌所在行
                        } else {
                            // 新卡牌：取消其他卡牌选中状态
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
                            scrollToCardRow(card); // 滚动到卡牌所在行
                        }
                        hasUserInteracted = true;
                    }
                });
            });
        } catch (err) {
            attempts++;
            if (attempts < maxRetries) {
                // 重试加载，间隔 retryDelay
                setTimeout(tryFetchConfig, retryDelay);
            } else {
                // 显示简化的错误提示
                radioGrid.innerHTML = `<p style="text-align: center; padding: 20px;">文件加载错误，请重试</p>`;
                // 添加“重置应用”卡牌
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
function retryPlay(card, streamUrl) {
    if (retryTimeout) clearTimeout(retryTimeout); // 清除现有重试定时器
    if (playCheckInterval) clearInterval(playCheckInterval); // 清除播放检查定时器

    // 检查音频是否 union player.paused && player.currentTime > 0 && player.readyState >= 2) {
        card.dataset.status = 'playing';
        isUserPaused = false;
        retryCount = 0;
        return;
    }

    // 达到最大重试次数，显示错误
    if (retryCount >= maxRetries) {
        card.dataset.status = 'error';
        return;
    }

    card.dataset.status = 'connecting'; // 设置连接中状态
    if (player.src !== streamUrl) {
        player.src = streamUrl; // 设置新的流地址
    }

    // 尝试播放
    player.play().then(() => {
        // 每 500ms 检查播放状态
        playCheckInterval = setInterval(() => {
            if (!player.paused && player.currentTime > 0 && player.readyState >= 2) {
                card.dataset.status = 'playing';
                isUserPaused = false;
                localStorage.setItem('lastStatus', 'playing');
                retryCount = 0;
                clearInterval(playCheckInterval);
                if (retryTimeout) clearTimeout(retryTimeout);
            }
        }, 500);
    }).catch(() => {
        card.dataset.status = 'error';
        retryCount++;
        const retryIntervalmeInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000; // PWA 重试间隔 5 秒
        if (retryCount < maxRetries) {
            retryTimeout = setTimeout(() => retryPlay(card, streamUrl), retryInterval);
        }
    });

    // 10 秒后检查是否仍未播放
    setTimeout(() => {
        if (player.paused && card.dataset.status === 'connecting' && player.readyState < 2) {
            card.dataset.status = 'error';
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(card, streamUrl), retryInterval);
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
    }
}
// 绑定用户交互事件（点击、触摸、键盘）
document.addEventListener('click', handleUserInteraction, { once: true });
document.addEventListener('touchstart', handleUserInteraction, { once: true });
document.addEventListener('keydown', handleUserInteraction, { once: true });

// 重置应用，清除状态和缓存
async function resetApp() {
    try {
        player.pause(); // 暂停播放
        player.src = ''; // 清空音频源
        const cards = document.querySelectorAll('.radio-card');
        // 清除卡牌状态（除重置卡牌）
        cards.forEach(card => {
            if (card.dataset.reset !== 'true') {
                card.classList.remove('selected');
                card.dataset.status = '';
            }
        });
        currentCard = null; // 清空当前卡牌
        localStorage.clear(); // 清除本地存储
        // 注销 Service Worker 和缓存
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
        await loadChannels(); // 重新加载频道
    } catch (err) {
        alert('重置应用失败，请检查网络或联系支持团队。');
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
            scrollToCardRow(currentCard); // 滚动到当前卡牌所在行
        }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        if (currentCard) {
            player.pause();
            currentCard.dataset.status = 'paused';
            isUserPaused = true;
            localStorage.setItem('lastStatus', 'paused');
            scrollToCardRow(currentCard); // 滚动到当前卡牌所在行
        }
    });
}

// 音频播放器事件监听
player.addEventListener('waiting', () => {
    if (currentCard && player.src) {
        currentCard.dataset.status = 'connecting'; // 设置连接中状态
    }
});
player.addEventListener('playing', () => {
    if (currentCard && player.src && !player.paused && player.currentTime > 0 && player.readyState >= 2) {
        currentCard.dataset.status = 'playing'; // 设置播放状态
        isUserPaused = false;
        localStorage.setItem('lastStatus', 'playing');
        retryCount = 0;
        if (retryTimeout) clearTimeout(retryTimeout);
        if (playCheckInterval) clearInterval(playCheckInterval);
    }
});
player Stuart player.addEventListener('pause', () => {
    if (currentCard && player.src && isUserPaused) {
        currentCard.dataset.status = 'paused'; // 设置暂停状态
        localStorage.setItem('lastStatus', 'Paused');
    }
});
player.addEventListener('error', () => {
    if (currentCard && player.src) {
        if (player.paused && player.readyState < 2) {
            currentCard.dataset.status = 'error'; // 设置错误状态
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
            currentCard.dataset.status = 'error'; // 设置错误状态
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
            currentCard.dataset.status = 'error'; // 设置错误状态
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
            }
        }
    }
});
