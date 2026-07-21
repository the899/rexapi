// ============================================================
// MAIN CONTROLLER — screen management, UI wiring, entry point
// ============================================================

let gameState = null;
let battleCtx = null;
let battleCanvas = null;
let animFrameId = null;
let currentScreen = null;

const SLOT_ICONS = {
  hull: '▣',
  cannon: '⌁',
  turretSys: '◎',
  tracks: '≋',
  armor: '◇',
  chip: '✦',
};

const SLOT_PART_IMAGES = {
  hull: 'part_hull.png',
  cannon: 'part_cannon.png',
  turretSys: 'part_turret.png',
  tracks: 'part_tracks.png',
  armor: 'part_armor.png',
  chip: 'part_chip.png',
};

const STAT_LABELS = {
  maxHp: '生命',
  speed: '速度',
  damage: '伤害',
  fireRate: '射速',
  fireRange: '射程',
  lockSpeed: '锁定',
  lockRange: '索敌',
  turnRate: '转向',
  dmgReduction: '减伤',
  shield: '护盾',
  ammoDuration: '火力弹',
  ammoDurationBonus: '火力弹',
  pickupRange: '拾取',
  killHeal: '击杀回血',
  slowResist: '减速抵抗',
  bulletSpeedMult: '弹速',
  blastDamageMult: '爆裂伤害',
  blastReduction: '爆炸减伤',
  lowHpSpeed: '低血机动',
  equipDropBonus: '装备掉落',
  bonusEquipChance: '附加概率',
};

function rarityName(rarity) {
  return {
    common: '普通',
    rare: '稀有',
    epic: '史诗',
    legendary: '传说',
  }[rarity] || rarity;
}

function formatStatKey(key) {
  return STAT_LABELS[key] || key;
}

function formatStatValue(key, value) {
  const sign = value > 0 ? '+' : '';
  if (key === 'fireRate') return `${value > 0 ? '快' : '慢'}${Math.abs(value).toFixed(2)}s`;
  if (key === 'pickupRange' || key === 'killHeal' || key === 'slowResist' || key === 'blastReduction' || key === 'lowHpSpeed' || key === 'equipDropBonus' || key === 'bonusEquipChance') return `${sign}${Math.round(value * 100)}%`;
  if (key === 'bulletSpeedMult' || key === 'blastDamageMult') {
    const pct = value < 0.5 ? value * 100 : (value - 1) * 100;
    return `${pct > 0 ? '+' : ''}${Math.round(pct)}%`;
  }
  return `${sign}${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

function formatStats(stats) {
  return Object.entries(stats)
    .map(([key, value]) => `${formatStatKey(key)} ${formatStatValue(key, value)}`)
    .join(' / ');
}

function formatEquipInventory(inv) {
  const total = inv?.count || 0;
  const bonus = Math.min(inv?.bonusCount || 0, total);
  const normal = Math.max(0, total - bonus);
  return `常规 ${normal} / 附加 ${bonus}`;
}

function formatBonusStats(item) {
  const bonusStats = typeof getItemBonusStats === 'function' ? getItemBonusStats(item) : item?.bonusStats;
  return bonusStats && Object.keys(bonusStats).length ? formatStats(bonusStats) : '无';
}

function getStageStatus(stage, index, save) {
  const completed = save.completedStages.includes(stage.id);
  const prevCompleted = index === 0 || save.completedStages.includes(STAGES[index - 1].id);
  const locked = !completed && !prevCompleted && index > 0;
  return { completed, locked };
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  currentScreen = id;
}

// ---- Garage ----
function renderGarage() {
  const save = gameState;
  const stats = getEquippedStats();
  document.getElementById('g-gold').textContent = save.gold;
  document.getElementById('g-tech').textContent = save.techPoints;
  document.getElementById('g-kills').textContent = save.totalKills;

  // Equipment slots
  const slotsHtml = document.getElementById('g-slots');
  slotsHtml.innerHTML = '';
  for (const slot of EQUIP_SLOTS) {
    const div = document.createElement('div');
    div.className = 'slot-item';
    const itemId = save.equipSlots[slot.id];
    const item = itemId ? EQUIP_ITEMS[itemId] : null;
    const inv = itemId ? save.inventory[itemId] : null;
    const bonusActive = itemId ? hasBonusEquipCopy(itemId, save) : false;

    if (item) {
      div.innerHTML = `
        <div class="slot-shell">
          <div class="slot-topline">
            <div class="slot-title">
              <span class="slot-icon slot-part ${bonusActive ? 'bonus-part' : ''}">
                <img src="assets/generated/${SLOT_PART_IMAGES[slot.id]}" alt="${slot.name}">
              </span>
              <div>
                <div class="slot-name">${slot.name}</div>
                <div class="slot-equip-name">${item.name}</div>
              </div>
            </div>
            <span class="rarity-pill rarity-${item.rarity}">${rarityName(item.rarity)}</span>
          </div>
          <div class="slot-desc">${item.desc || slot.desc}</div>
          <div class="slot-bottomline">
            <span class="slot-stats">常规：${formatStats(item.stats)}</span>
            ${bonusActive ? `<span class="slot-stats">附加：${formatBonusStats(item)}</span>` : ''}
          </div>
        </div>
      `;
    } else {
      div.innerHTML = `
        <div class="slot-shell">
          <div class="slot-topline">
            <div class="slot-title">
              <span class="slot-icon slot-part empty-part">
                <img src="assets/generated/${SLOT_PART_IMAGES[slot.id]}" alt="${slot.name}">
              </span>
              <div>
                <div class="slot-name">${slot.name}</div>
                <div class="slot-equip-name empty-slot">未装配</div>
              </div>
            </div>
            <span class="rarity-pill">空槽</span>
          </div>
          <div class="slot-desc">${slot.desc}</div>
          <div class="slot-stats">点击选择装备</div>
        </div>
      `;
    }
    div.addEventListener('click', () => openEquipPanel(slot.id));
    slotsHtml.appendChild(div);
  }

  const rightPanel = document.querySelector('.garage-right');
  if (rightPanel) {
    const equippedCount = EQUIP_SLOTS.filter(slot => save.equipSlots[slot.id]).length;
    const completedCount = save.completedStages.length;
    rightPanel.innerHTML = `
      <div class="stat-panel">
        <div class="stat-panel-title">当前整备</div>
        <div class="stat-grid">
          <div class="stat-box"><div class="label">生命</div><div class="value">${Math.round(stats.maxHp)}</div></div>
          <div class="stat-box"><div class="label">速度</div><div class="value">${Math.round(stats.speed)}</div></div>
          <div class="stat-box"><div class="label">伤害</div><div class="value">${Math.round(stats.damage)}</div></div>
          <div class="stat-box"><div class="label">射速</div><div class="value">${Math.max(1, Math.round(1 / stats.fireRate))}/s</div></div>
          <div class="stat-box"><div class="label">减伤</div><div class="value">${Math.round(stats.dmgReduction || 0)}</div></div>
          <div class="stat-box"><div class="label">拾取</div><div class="value">${Math.round((stats.pickupRange || 1) * 100)}%</div></div>
          <div class="stat-box"><div class="label">弹速</div><div class="value">${Math.round((stats.bulletSpeedMult || 1) * 100)}%</div></div>
          <div class="stat-box"><div class="label">爆抗</div><div class="value">${Math.round((stats.blastReduction || 0) * 100)}%</div></div>
          <div class="stat-box"><div class="label">装备</div><div class="value">${Math.round((stats.equipDropBonus || 0) * 100)}%</div></div>
        </div>
      </div>
      <div class="stat-panel">
        <div class="stat-panel-title">作战进度</div>
        <div class="garage-brief">
          <div class="brief-row"><span>已装配槽位</span><strong>${equippedCount}/${EQUIP_SLOTS.length}</strong></div>
          <div class="brief-row"><span>已完成关卡</span><strong>${completedCount}/${STAGES.length}</strong></div>
          <div class="brief-row"><span>累计击杀</span><strong>${save.totalKills || 0}</strong></div>
        </div>
      </div>
      <div class="garage-actions">
        <button class="btn btn-help" id="nav-help">❔ 游戏说明</button>
        <button class="btn btn-primary" id="nav-tech">🔬 科技树</button>
      </div>
      <div class="garage-tip">局内拾取火力弹会临时切换攻击方式；装备箱会带回车库，用来替换部件并形成长期 Build。</div>
    `;
    document.getElementById('nav-help').addEventListener('click', openHelpPanel);
    document.getElementById('nav-tech').addEventListener('click', () => {
      renderTechTree();
      showScreen('tech-screen');
    });
  }

  // Tank preview mirrors the in-battle player rendering.
  const previewCanvas = document.getElementById('tank-preview-canvas');
  if (previewCanvas) {
    const ctx = previewCanvas.getContext('2d');
    const w = previewCanvas.width;
    const h = previewCanvas.height;
    const cx = w / 2, cy = h / 2;

    function drawPreview() {
      ctx.clearRect(0, 0, w, h);
      const ground = BATTLE_ASSETS?.terrain?.concrete;
      if (ground?.ready) {
        ctx.drawImage(ground.img, 0, 0, w, h);
        ctx.fillStyle = 'rgba(4,8,13,0.32)';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = '#101824';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.strokeStyle = 'rgba(88,166,255,0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= w; i += 24) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      }
      for (let i = 0; i <= h; i += 24) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
      ctx.save();
      ctx.translate(cx, cy + 8);
      ctx.scale(1.35, 0.45);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const angle = -0.18;
      const spriteKey = getPlayerTankSpriteKey ? getPlayerTankSpriteKey() : 'player';
      const previewScale = spriteKey === 'playerHeavy' ? 2.48 : spriteKey === 'playerLight' ? 2.18 : 2.34;
      if ((stats.shield || 0) > 0 && typeof drawTankShieldAura === 'function') {
        drawTankShieldAura(ctx, spriteKey, cx, cy, angle, previewScale + 0.24);
      }
      if (!drawTankSprite(ctx, spriteKey, cx, cy, angle, previewScale)) {
        ctx.fillStyle = '#2f88d8';
        ctx.strokeStyle = '#9fd6ff';
        ctx.lineWidth = 2;
        ctx.fillRect(cx - 26, cy - 18, 52, 36);
        ctx.strokeRect(cx - 26, cy - 18, 52, 36);
      }

      drawBullet(ctx, createBullet(cx + 78, cy - 16, angle, 10, 200, 'player', { color: '#ffd700' }));

      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(cx - 52, cy - 82, 104, 8);
      ctx.fillStyle = '#3fb950';
      ctx.fillRect(cx - 52, cy - 82, 104, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 52, cy - 82, 104, 8);
      ctx.fillStyle = 'rgba(230,237,243,0.78)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('战斗预览', cx, h - 24);

      if (!BATTLE_ASSETS?.tanks?.player?.ready || !BATTLE_ASSETS?.terrain?.concrete?.ready || !BATTLE_ASSETS?.bullets?.basic?.ready) {
        setTimeout(drawPreview, 120);
      }
    }

    drawPreview();
  }
}

// ---- Equipment Panel ----
function openEquipPanel(slotId) {
  const slot = EQUIP_SLOTS.find(s => s.id === slotId);
  if (!slot) return;

  const panel = document.getElementById('equip-screen');
  const title = document.getElementById('equip-title');
  const list = document.getElementById('equip-item-list');
  title.textContent = `${slot.name} — 选择装备`;
  list.innerHTML = '';

  const save = gameState;
  const currentItemId = save.equipSlots[slotId];
  const available = Object.values(EQUIP_ITEMS).filter(item => {
    if (item.slot !== slotId) return false;
    const inv = save.inventory[item.id];
    return inv && inv.owned && inv.count > 0;
  });

  // Empty option
  const emptyDiv = document.createElement('div');
  emptyDiv.className = `equip-entry ${!currentItemId ? 'selected' : ''}`;
  emptyDiv.innerHTML = '<span class="equip-name" style="color:var(--text-secondary)">空</span><span class="equip-action">—</span>';
  emptyDiv.addEventListener('click', () => {
    save.equipSlots[slotId] = null;
    saveGame();
    openEquipPanel(slotId);
    renderGarage();
  });
  list.appendChild(emptyDiv);

  if (available.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'equip-empty';
    empty.textContent = '没有可用的装备';
    list.appendChild(empty);
  } else {
    for (const item of available) {
      const div = document.createElement('div');
      const isEquipped = currentItemId === item.id;
      div.className = `equip-entry ${isEquipped ? 'equipped' : ''}`;
      const inv = save.inventory[item.id];
      const statsStr = formatStats(item.stats);
      const bonusStatsStr = formatBonusStats(item);
      const inventoryStr = formatEquipInventory(inv);
      const hasBonus = hasBonusEquipCopy(item.id, save);
      div.innerHTML = `
        <div>
          <div class="equip-main">
            <span class="equip-name" style="color:${RARITY_COLORS[item.rarity]}">${item.name}</span>
            <span class="rarity-pill rarity-${item.rarity}">${rarityName(item.rarity)}</span>
          </div>
          <div class="equip-desc">${item.desc}</div>
          <div class="equip-stats">常规数据：${statsStr}</div>
          <div class="equip-stats">${hasBonus ? '附加属性' : '附加属性预览'}：${bonusStatsStr}</div>
          <div class="equip-stats">库存：${inventoryStr}</div>
        </div>
        <span class="equip-action">${isEquipped ? '已装备' : '装配'}</span>
      `;
      div.addEventListener('click', () => {
        save.equipSlots[slotId] = item.id;
        saveGame();
        openEquipPanel(slotId);
        renderGarage();
      });
      list.appendChild(div);
    }
  }

  showScreen('equip-screen');
}

function closeEquipPanel() {
  showScreen('garage-screen');
  renderGarage();
}

// ---- Tech Tree ----
function renderTechTree() {
  const panel = document.getElementById('tech-tree-panel');
  panel.innerHTML = '';
  const save = gameState;

  for (const tree of TECH_TREES) {
    const row = document.createElement('div');
    row.className = 'tech-tree-row';

    const title = document.createElement('h3');
    title.style.color = tree.color;
    title.textContent = tree.name;
    row.appendChild(title);

    const nodesDiv = document.createElement('div');
    nodesDiv.className = 'tech-nodes';

    for (const node of tree.nodes) {
      const lvl = save.techLevels[node.id] || 0;
      const maxed = lvl >= node.maxLevel;
      const cost = node.costBase + node.costPerLevel * lvl;
      const affordable = save.techPoints >= cost && !maxed;

      const nd = document.createElement('div');
      nd.className = `tech-node ${maxed ? 'maxed' : ''} ${!affordable && !maxed ? 'locked' : ''}`;

      nd.innerHTML = `
        <div class="equip-main">
          <div class="node-name">${node.name}</div>
          <span class="status-chip">${maxed ? '满级' : affordable ? '可升级' : '点数不足'}</span>
        </div>
        <div class="node-desc">${node.desc}</div>
        <div class="node-level">${maxed ? 'Lv.MAX' : `Lv.${lvl} → Lv.${lvl + 1}`}</div>
        <div class="node-cost">${maxed ? '无需继续投入' : `消耗 ${cost} 科技点`}</div>
      `;

      if (affordable) {
        nd.addEventListener('click', () => {
          if (save.techPoints >= cost) {
            save.techPoints -= cost;
            save.techLevels[node.id] = lvl + 1;
            saveGame();
            renderTechTree();
            // Also refresh garage display for resource updates
            document.getElementById('t-tech').textContent = save.techPoints;
          }
        });
      }

      nodesDiv.appendChild(nd);
    }

    row.appendChild(nodesDiv);
    panel.appendChild(row);
  }

  document.getElementById('t-tech').textContent = save.techPoints;
}

// ---- Stage Select ----
function renderStageSelect() {
  const grid = document.getElementById('stage-grid');
  grid.innerHTML = '';
  const save = gameState;

  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    const { completed, locked } = getStageStatus(stage, i, save);
    const difficultyPct = clamp((stage.difficulty || 1) / 2.5 * 100, 20, 100);
    const enemyNames = stage.enemies.map(id => ENEMY_DEFS[id]?.name || id).join(' / ');
    const status = completed ? '已通关' : locked ? '未解锁' : '可挑战';

    const card = document.createElement('div');
    card.className = `stage-card ${locked ? 'locked' : ''} ${completed ? 'completed' : ''}`;
    card.innerHTML = `
      <div class="stage-topline">
        <div class="stage-topline">
          <span class="stage-index">${String(i + 1).padStart(2, '0')}</span>
          <div>
            <div class="stage-name">${stage.name}</div>
            <div class="stage-info">${stage.desc}</div>
          </div>
        </div>
        <span class="stage-tag">${status}</span>
      </div>
      <div class="stage-meta">
        <span>${stage.time}s</span>
        <span>难度 ${stage.difficulty}</span>
      </div>
      <div class="difficulty-bar"><div class="difficulty-fill" style="width:${difficultyPct}%"></div></div>
      <div class="stage-info">敌人：${enemyNames}</div>
      <div class="stage-drops">掉落：${[...new Set(stage.drops)].join(' / ')}</div>
    `;

    if (!locked) {
      card.addEventListener('click', () => startBattle(stage));
    }

    grid.appendChild(card);
  }
}

// ---- Battle ----
let battleRunning = false;
let battleBgm = null;

function getBattleBgm() {
  if (!battleBgm) {
    battleBgm = new Audio('assets/audio/doubao_battle_bgm.mp4');
    battleBgm.loop = true;
    battleBgm.volume = 0.42;
    battleBgm.preload = 'auto';
  }
  return battleBgm;
}

function playBattleBgm() {
  const bgm = getBattleBgm();
  bgm.currentTime = 0;
  const playPromise = bgm.play();
  if (playPromise?.catch) {
    playPromise.catch(() => {
      addBattleMessage('音乐播放被浏览器拦截', '#d29922');
    });
  }
}

function stopBattleBgm() {
  if (!battleBgm) return;
  battleBgm.pause();
  battleBgm.currentTime = 0;
}

function startBattle(stage) {
  const stats = getEquippedStats();
  generateObstacles();
  initGame(stage, stats);
  battleRunning = true;
  playBattleBgm();

  // Show battle screen
  showScreen('battle-screen');
  document.getElementById('battle-message').classList.remove('show');
  battleMessages = [];

  // Setup canvas
  battleCanvas = document.getElementById('battle-canvas');
  const rect = battleCanvas.parentElement.getBoundingClientRect();
  battleCanvas.width = rect.width;
  battleCanvas.height = rect.height;
  battleCtx = battleCanvas.getContext('2d');

  // HUD update timer
  let hudUpdateInterval = setInterval(() => {
    if (!battleRunning || !game) {
      clearInterval(hudUpdateInterval);
      return;
    }
    updateHUD();
  }, 100);

  // Game loop
  let lastTime = performance.now();
  function frame(time) {
    if (!battleRunning) return;
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    updateGame(dt);
    renderGame();

    // Battle messages
    const msgEl = document.getElementById('battle-message');
    for (let i = battleMessages.length - 1; i >= 0; i--) {
      battleMessages[i].timer -= dt;
      if (battleMessages[i].timer <= 0) battleMessages.splice(i, 1);
    }
    if (battleMessages.length > 0) {
      msgEl.textContent = battleMessages[battleMessages.length - 1].text;
      msgEl.style.color = battleMessages[battleMessages.length - 1].color || '#fff';
      msgEl.classList.add('show');
    } else {
      msgEl.classList.remove('show');
    }

    animFrameId = requestAnimationFrame(frame);
  }

  animFrameId = requestAnimationFrame(frame);
}

function updateHUD() {
  if (!game || !game.player) return;
  const p = game.player;
  const timeLeft = Math.max(0, game.maxTime - game.time);
  const hpPct = clamp((p.hp / p.maxHp) * 100, 0, 100);
  document.getElementById('hud-hp').textContent = `${Math.ceil(p.hp)}/${p.maxHp}`;
  document.getElementById('hud-hp-fill').style.width = `${hpPct}%`;
  document.getElementById('hud-time').textContent = `${Math.ceil(timeLeft)}s`;
  document.getElementById('hud-kills').textContent = `击杀: ${game.stats.kills}`;
  const ammoEl = document.getElementById('hud-ammo');
  if (p.currentAmmo) {
    const total = p.currentAmmo.duration + (p.ammoDurationBonus || 0);
    const pct = clamp((p.ammoTimer / total) * 100, 0, 100);
    ammoEl.innerHTML = `
      <div class="hud-ammo-wrap">
        <div class="hud-ammo-name">${p.currentAmmo.name} ${Math.ceil(p.ammoTimer)}s</div>
        <div class="hud-ammo-track"><div class="hud-ammo-fill" style="width:${pct}%;background:${p.currentAmmo.color}"></div></div>
      </div>
    `;
  } else {
    ammoEl.innerHTML = `
      <div class="hud-ammo-wrap">
        <div class="hud-ammo-name">基础弹</div>
        <div class="hud-ammo-track"><div class="hud-ammo-fill" style="width:100%;background:var(--steel)"></div></div>
      </div>
    `;
  }
}

function showSettlement(victory, gold, tech, equipRewards) {
  battleRunning = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  stopBattleBgm();

  showScreen('settlement-screen');

  const title = document.getElementById('settlement-title');
  title.textContent = victory ? '胜利！' : '阵亡';
  title.className = `settlement-title ${victory ? 'victory' : 'defeat'}`;

  document.getElementById('set-kills').textContent = game.stats.kills;
  document.getElementById('set-damage').textContent = Math.round(game.stats.damageDealt);
  document.getElementById('set-time').textContent = `${Math.floor(game.elapsed)}s`;
  document.getElementById('set-ammo').textContent = game.stats.ammoCollected;

  const rewardsDiv = document.getElementById('set-rewards');
  const equipText = equipRewards.map(id => (EQUIP_ITEMS[id] || {}).name || id).join(' / ');
  rewardsDiv.innerHTML = `
    <div class="reward-row"><span>金币</span><span style="color:var(--gold)">+${gold}</span></div>
    <div class="reward-row"><span>科技点</span><span style="color:var(--accent)">+${tech}</span></div>
    <div class="reward-row"><span>装备箱</span><span style="color:var(--gold)">${equipRewards.length > 0 ? equipText : '无'}</span></div>
    <div class="reward-row"><span>拾取装备</span><span style="color:var(--green)">+${game.stats.equipCollected}</span></div>
  `;

  document.getElementById('set-next').textContent = victory && game.completed ? '下一关' : '再来一局';

  // Refresh garage data
  renderGarage();
}

function settlementRetry() {
  // Go back to stage select
  renderStageSelect();
  showScreen('stage-screen');
}

function settlementNext() {
  renderStageSelect();
  showScreen('stage-screen');
}

function settlementGarage() {
  renderGarage();
  showScreen('garage-screen');
}

function openHelpPanel() {
  showScreen('help-screen');
}

function closeHelpPanel() {
  renderGarage();
  showScreen('garage-screen');
}

// ---- Window resize ----
function onResize() {
  if (battleCanvas && currentScreen === 'battle-screen') {
    const rect = battleCanvas.parentElement.getBoundingClientRect();
    battleCanvas.width = rect.width;
    battleCanvas.height = rect.height;
    if (battleCtx) battleCtx = battleCanvas.getContext('2d');
  }
}

// ---- Init ----
function init() {
  gameState = loadSave();

  // Navigation
  document.getElementById('nav-battle').addEventListener('click', () => {
    renderStageSelect();
    showScreen('stage-screen');
  });
  document.getElementById('nav-tech').addEventListener('click', () => {
    renderTechTree();
    showScreen('tech-screen');
  });
  document.getElementById('nav-back-stages').addEventListener('click', () => {
    renderGarage();
    showScreen('garage-screen');
  });
  document.getElementById('tech-back').addEventListener('click', () => {
    renderGarage();
    showScreen('garage-screen');
  });
  document.getElementById('close-equip').addEventListener('click', closeEquipPanel);
  document.getElementById('close-help').addEventListener('click', closeHelpPanel);

  // Settlement buttons
  document.getElementById('set-retry').addEventListener('click', settlementRetry);
  document.getElementById('set-next').addEventListener('click', settlementNext);
  document.getElementById('set-garage').addEventListener('click', settlementGarage);

  window.addEventListener('resize', onResize);

  // Show garage
  renderGarage();
  showScreen('garage-screen');
}

document.addEventListener('DOMContentLoaded', init);
