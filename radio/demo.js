// 确保最小窗口尺寸
function ensureMinimumWindowSize() {
    const minWidth = 360;
    const minHeight = 640;
    if (window.innerWidth < minWidth || window.innerHeight < minHeight) {
        window.resizeTo(
            Math.max(window.outerWidth + (minWidth - window.innerWidth), minWidth),
            Math.max(window.outerHeight + (minHeight - window.innerHeight), minHeight)
        );
    }
}
// 在非 PWA 模式下检查窗口尺寸
if (!('standalone' in navigator && navigator.standalone)) {
    window.addEventListener('resize', ensureMinimumWindowSize);
    window.addEventListener('load', ensureMinimumWindowSize);
}
// 注册 Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/radio/sw.js')
            .then(reg => console.log('Service Worker 注册成功'))
            .catch(err => console.log('Service Worker 注册失败：', err));
    });
}
// 卡牌交互和音频播放
const radioGrid = document.querySelector('.radio-grid');
const player = document.getElementById('radio-player');
let currentCard = null;
let retryTimeout = null;
let retryCount = 0; // 重试计数
const maxRetries = 5; // 最大重试次数
let isUserPaused = false; // 区分用户主动暂停和自动暂停
let playCheckInterval = null; // 持续检查播放状态
let hasUserInteracted = false; // 会话级别交互状态
// 自动重试函数
function retryPlay(card, streamUrl) {
    if (retryTimeout) clearTimeout(retryTimeout);
    if (playCheckInterval) clearInterval(playCheckInterval);
    if (player.src === streamUrl && !player.paused && player.currentTime > 0 && player.readyState >= 2) {
        card.dataset.status = 'playing';
        console.log('Already playing, maintaining playing status for card:', card.querySelector('span').textContent);
        isUserPaused = false;
        retryCount = 0;
        return;
    }
    if (retryCount >= maxRetries) {
        card.dataset.status = 'error';
        console.log('Max retries reached, stopping');
        return;
    }
    card.dataset.status = 'connecting';
    console.log('Set status to connecting for card:', card.querySelector('span').textContent);
    if (player.src !== streamUrl) {
        player.src = streamUrl;
    }
    player.play().then(() => {
        playCheckInterval = setInterval(() => {
            if (!player.paused && player.currentTime > 0 && player.readyState >= 2) {
                card.dataset.status = 'playing';
                console.log('Play confirmed, set to playing');
                isUserPaused = false;
                localStorage.setItem('lastStatus', 'playing');
                retryCount = 0;
                clearInterval(playCheckInterval);
                if (retryTimeout) clearTimeout(retryTimeout);
            }
        }, 500);
    }).catch(err => {
        console.log('播放失败，重试中：', err);
        card.dataset.status = 'error';
        console.log('Play failed, set to error');
        retryCount++;
        const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
        if (retryCount < maxRetries) {
            retryTimeout = setTimeout(() => retryPlay(card, streamUrl), retryInterval);
        } else {
            console.log('Max retries reached, stopping');
        }
    });
    setTimeout(() => {
        if (player.paused && card.dataset.status === 'connecting' && player.readyState < 2) {
            card.dataset.status = 'error';
            console.log('Still paused after 10s with insufficient readyState, set to error');
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(card, streamUrl), retryInterval);
            } else {
                console.log('Max retries reached, stopping');
            }
        }
    }, 10000);
}
// 检测用户交互
function handleUserInteraction() {
    if (!hasUserInteracted && currentCard && currentCard.dataset.status === 'error') {
        hasUserInteracted = true;
        console.log('User interacted, retrying play');
        retryCount = 0;
        retryPlay(currentCard, currentCard.dataset.stream);
    }
}
document.addEventListener('click', handleUserInteraction, { once: true });
document.addEventListener('touchstart', handleUserInteraction, { once: true });
document.addEventListener('keydown', handleUserInteraction, { once: true });
// 动态加载频道
fetch('/radio/config.json')
    .then(response => response.json())
    .then(channels => {
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
        const cards = document.querySelectorAll('.radio-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
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
                    cards.forEach(c => {
                        c.classList.remove('selected');
                        c.dataset.status = '';
                    });
                    card.classList.add('selected');
                    currentCard = card;
                    localStorage.setItem('lastStream', streamUrl);
                    localStorage.setItem('lastStatus', 'playing');
                    isUserPaused = false;
                    retryCount = 0;
                    retryPlay(card, streamUrl);
                }
                hasUserInteracted = true;
            });
        });
        const savedStream = localStorage.getItem('lastStream');
        const savedStatus = localStorage.getItem('lastStatus');
        if (savedStream && savedStatus !== 'paused') {
            const savedCard = Array.from(cards).find(card => card.dataset.stream === savedStream);
            if (savedCard) {
                savedCard.classList.add('selected');
                currentCard = savedCard;
                isUserPaused = false;
                retryPlay(savedCard, savedStream);
            }
        }
    })
    .catch(err => {
        console.error('加载 config.json 失败：', err);
        radioGrid.innerHTML = '<p>无法加载频道，请检查网络或 config.json</p>';
    });
// Media Session API 实现后台播放
if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
        title: '经典旋律',
        artist: '轻松调频电台',
        album: '经典旋律轻松调频'
    });
    navigator.mediaSession.setActionHandler('play', () => {
        if (currentCard) {
            isUserPaused = false;
            retryCount = 0;
            retryPlay(currentCard, currentCard.dataset.stream);
        }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
        if (currentCard) {
            player.pause();
            currentCard.dataset.status = 'paused';
            isUserPaused = true;
            localStorage.setItem('lastStatus', 'paused');
        }
    });
}
// 音频状态监听
player.addEventListener('waiting', () => {
    if (currentCard && player.src) {
        currentCard.dataset.status = 'connecting';
        console.log('Audio waiting, set to connecting');
    }
});
player.addEventListener('playing', () => {
    if (currentCard && player.src && !player.paused && player.currentTime > 0 && player.readyState >= 2) {
        currentCard.dataset.status = 'playing';
        console.log('Audio playing, set to playing');
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
        console.log('Audio paused by user, set to paused');
        localStorage.setItem('lastStatus', 'paused');
    }
});
player.addEventListener('error', () => {
    if (currentCard && player.src) {
        if (player.paused && player.readyState < 2) {
            currentCard.dataset.status = 'error';
            console.log('Audio error, set to error');
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
            } else {
                console.log('Max retries reached, stopping');
            }
        }
    }
});
player.addEventListener('stalled', () => {
    if (currentCard && player.src) {
        if (player.paused && player.readyState < 2) {
            currentCard.dataset.status = 'error';
            console.log('Audio stalled, set to error');
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
            } else {
                console.log('Max retries reached, stopping');
            }
        }
    }
});
player.addEventListener('suspend', () => {
    if (currentCard && player.src) {
        if (player.paused && player.readyState < 2) {
            currentCard.dataset.status = 'error';
            console.log('Audio suspended, set to error');
            retryCount++;
            const retryInterval = ('standalone' in navigator && navigator.standalone) ? 5000 : 3000;
            if (retryCount < maxRetries) {
                retryTimeout = setTimeout(() => retryPlay(currentCard, currentCard.dataset.stream), retryInterval);
            } else {
                console.log('Max retries reached, stopping');
            }
        }
    }
});