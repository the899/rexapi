// ============================================================
// GAME DATA — all definitions: stages, enemies, ammo, equipment, tech
// ============================================================

const RARITY = {
  COMMON: 'common',
  RARE: 'rare',
  EPIC: 'epic',
  LEGENDARY: 'legendary',
};

const RARITY_COLORS = {
  common: '#8b949e',
  rare: '#58a6ff',
  epic: '#bc8cff',
  legendary: '#ffd700',
};

const RARITY_MULT = {
  common: 1.0,
  rare: 1.3,
  epic: 1.6,
  legendary: 2.0,
};

// ---------- POWER-UP AMMO ----------
const AMMO_DEFS = {
  scatter: {
    id: 'scatter',
    name: '散射弹',
    desc: '3发扇形散射',
    dropLetter: 'S',
    color: '#ff6b6b',
    duration: 18,
    shots: 3,
    spread: 0.4,
    damageMult: 0.7,
    speedMult: 1.0,
  },
  pierce: {
    id: 'pierce',
    name: '穿甲弹',
    desc: '穿透敌人并击碎墙体',
    dropLetter: 'P',
    color: '#ffd93d',
    duration: 18,
    shots: 1,
    pierce: true,
    damageMult: 1.2,
    speedMult: 1.3,
  },
  burst: {
    id: 'burst',
    name: '爆裂弹',
    desc: '命中后小范围爆炸',
    dropLetter: 'B',
    color: '#ff8a5c',
    duration: 16,
    shots: 1,
    explosion: true,
    explosionRadius: 40,
    damageMult: 1.0,
    speedMult: 0.9,
  },
  emp: {
    id: 'emp',
    name: '电磁弹',
    desc: '减速敌人',
    dropLetter: 'E',
    color: '#6bcbff',
    duration: 17,
    shots: 1,
    slowEffect: 0.4,
    slowDuration: 2,
    damageMult: 0.8,
    speedMult: 1.1,
  },
};

const AMMO_LIST = Object.values(AMMO_DEFS);

// ---------- ENEMIES ----------
const ENEMY_DEFS = {
  chaser: {
    id: 'chaser',
    name: '追击车',
    hp: 20,
    speed: 60,
    damage: 8,
    size: 14,
    color: '#e74c3c',
    score: 10,
    type: 'chaser',
  },
  turret: {
    id: 'turret',
    name: '固定炮台',
    hp: 40,
    speed: 0,
    damage: 12,
    size: 18,
    color: '#8e44ad',
    score: 20,
    type: 'turret',
    fireRate: 1.5,
    fireRange: 280,
  },
  missile: {
    id: 'missile',
    name: '导弹车',
    hp: 25,
    speed: 28,
    damage: 18,
    size: 15,
    color: '#e67e22',
    score: 20,
    type: 'missile',
    fireRate: 3.8,
    fireRange: 360,
    rocketFlightTime: 1.15,
    rocketExplosionRadius: 34,
  },
  elite: {
    id: 'elite',
    name: '精英重炮',
    hp: 120,
    speed: 25,
    damage: 20,
    size: 24,
    color: '#c0392b',
    score: 50,
    type: 'elite',
    fireRate: 2.0,
    fireRange: 320,
    burstCount: 3,
    burstSpread: 0.3,
  },
};

// ---------- EQUIPMENT SLOTS ----------
const EQUIP_SLOTS = [
  {
    id: 'hull',
    name: '车体',
    desc: '基础生命与承重',
  },
  {
    id: 'cannon',
    name: '主炮',
    desc: '基础伤害与射速',
  },
  {
    id: 'turretSys',
    name: '炮塔',
    desc: '瞄准速度与锁定',
  },
  {
    id: 'tracks',
    name: '履带',
    desc: '速度与转向',
  },
  {
    id: 'armor',
    name: '装甲',
    desc: '减伤与护盾',
  },
  {
    id: 'chip',
    name: '芯片',
    desc: '特殊被动效果',
  },
];

// ---------- EQUIPMENT ITEMS ----------
const EQUIP_ITEMS = {
  // HULL
  light_hull: {
    id: 'light_hull', slot: 'hull', rarity: 'common', name: '轻型车体',
    desc: '速度快，血量略低', stats: { maxHp: 20, speed: 10 },
    bonusStats: { pickupRange: 0.15 },
    bonusDesc: '附加：拾取范围+15%',
    tags: ['机动', '补给'],
  },
  heavy_hull: {
    id: 'heavy_hull', slot: 'hull', rarity: 'common', name: '重型车体',
    desc: '高血量，速度略降', stats: { maxHp: 60, speed: -5 },
    bonusStats: { blastReduction: 0.12 },
    bonusDesc: '附加：爆炸伤害-12%',
    tags: ['生存', '抗压'],
  },
  balanced_hull: {
    id: 'balanced_hull', slot: 'hull', rarity: 'rare', name: '均衡车体',
    desc: '血量和速度兼备', stats: { maxHp: 40, speed: 5 },
    bonusStats: { lowHpSpeed: 0.18 },
    bonusDesc: '附加：低血量移速+18%',
    tags: ['生存', '机动'],
  },
  // CANNON
  rapid_cannon: {
    id: 'rapid_cannon', slot: 'cannon', rarity: 'common', name: '速射炮',
    desc: '射速快，伤害低', stats: { damage: -5, fireRate: 0.15 },
    bonusStats: { bulletSpeedMult: 0.12 },
    bonusDesc: '附加：子弹速度+12%',
    tags: ['火控', '速射'],
  },
  heavy_cannon: {
    id: 'heavy_cannon', slot: 'cannon', rarity: 'common', name: '重击炮',
    desc: '伤害高，射速慢', stats: { damage: 10, fireRate: -0.1 },
    bonusStats: { blastDamageMult: 0.12 },
    bonusDesc: '附加：爆裂伤害+12%',
    tags: ['火控', '爆破'],
  },
  precision_cannon: {
    id: 'precision_cannon', slot: 'cannon', rarity: 'rare', name: '精准炮',
    desc: '射程远，弹道稳定', stats: { damage: 5, fireRate: 0.05 },
    bonusStats: { fireRange: 35, bulletSpeedMult: 0.08 },
    bonusDesc: '附加：射程+35 / 子弹速度+8%',
    tags: ['火控', '远程'],
  },
  // TURRET SYSTEM
  fast_turret: {
    id: 'fast_turret', slot: 'turretSys', rarity: 'common', name: '快速炮塔',
    desc: '更快锁定目标', stats: { lockSpeed: 0.3 },
    bonusStats: { turnRate: 0.25 },
    bonusDesc: '附加：炮塔转向+0.25',
    tags: ['火控', '机动'],
  },
  wide_turret: {
    id: 'wide_turret', slot: 'turretSys', rarity: 'rare', name: '广角炮塔',
    desc: '更大的锁定范围', stats: { lockRange: 30 },
    bonusStats: { lockSpeed: 0.18 },
    bonusDesc: '附加：锁定速度+18%',
    tags: ['火控', '索敌'],
  },
  // TRACKS
  speed_tracks: {
    id: 'speed_tracks', slot: 'tracks', rarity: 'common', name: '高速履带',
    desc: '移动更快', stats: { speed: 15 },
    bonusStats: { slowResist: 0.12 },
    bonusDesc: '附加：减速抵抗+12%',
    tags: ['机动'],
  },
  maneuver_tracks: {
    id: 'maneuver_tracks', slot: 'tracks', rarity: 'rare', name: '机动履带',
    desc: '转向更快', stats: { speed: 8, turnRate: 0.5 },
    bonusStats: { lowHpSpeed: 0.16 },
    bonusDesc: '附加：低血量移速+16%',
    tags: ['机动', '闪避'],
  },
  // ARMOR
  light_armor: {
    id: 'light_armor', slot: 'armor', rarity: 'common', name: '轻型装甲',
    desc: '少量减伤', stats: { dmgReduction: 3 },
    bonusStats: { speed: 5 },
    bonusDesc: '附加：速度+5',
    tags: ['生存', '机动'],
  },
  heavy_armor: {
    id: 'heavy_armor', slot: 'armor', rarity: 'rare', name: '重型装甲',
    desc: '显著减伤，轻微降速', stats: { dmgReduction: 8, speed: -3 },
    bonusStats: { blastReduction: 0.18 },
    bonusDesc: '附加：爆炸伤害-18%',
    tags: ['生存', '抗爆'],
  },
  shield_armor: {
    id: 'shield_armor', slot: 'armor', rarity: 'rare', name: '能量护盾',
    desc: '每30秒生成护盾', stats: { shield: 20 },
    bonusStats: { shieldRegen: 0.8 },
    bonusDesc: '附加：护盾恢复+0.8/s',
    tags: ['生存', '护盾'],
  },
  // CHIPS
  duration_chip: {
    id: 'duration_chip', slot: 'chip', rarity: 'common', name: '续航芯片',
    desc: '火力弹+4秒', stats: { ammoDurationBonus: 4 },
    bonusStats: { ammoDurationBonus: 2 },
    bonusDesc: '附加：火力弹额外+2秒',
    tags: ['战术', '火力弹'],
  },
  magnet_chip: {
    id: 'magnet_chip', slot: 'chip', rarity: 'rare', name: '磁吸芯片',
    desc: '拾取范围+50%', stats: { pickupRange: 0.5 },
    bonusStats: { equipDropBonus: 0.08 },
    bonusDesc: '附加：装备掉落权重+8%',
    tags: ['战术', '补给'],
  },
  life_chip: {
    id: 'life_chip', slot: 'chip', rarity: 'rare', name: '回血芯片',
    desc: '击杀5%概率回血', stats: { killHeal: 0.05 },
    bonusStats: { killHeal: 0.03 },
    bonusDesc: '附加：击杀回血概率+3%',
    tags: ['生存', '续航'],
  },
};

// ---------- TECH TREE ----------
const TECH_TREES = [
  {
    id: 'survival',
    name: '生存线',
    color: '#3fb950',
    nodes: [
      {
        id: 'surv_hp', name: '生命强化', desc: '最大生命+20',
        maxLevel: 3, costBase: 50, costPerLevel: 30,
        apply: (lvl, stats) => { stats.maxHp += 20 * lvl; },
      },
      {
        id: 'surv_shield', name: '护盾恢复', desc: '每秒护盾恢复+1',
        maxLevel: 3, costBase: 40, costPerLevel: 25,
        apply: (lvl, stats) => { stats.shieldRegen += 1 * lvl; },
      },
      {
        id: 'surv_collision', name: '碰撞减伤', desc: '碰撞受伤-2',
        maxLevel: 2, costBase: 50, costPerLevel: 40,
        apply: (lvl, stats) => { stats.collisionReduction += 2 * lvl; },
      },
      {
        id: 'surv_blast', name: '爆炸缓冲', desc: '爆炸伤害-8%',
        maxLevel: 3, costBase: 60, costPerLevel: 35,
        apply: (lvl, stats) => { stats.blastReduction = (stats.blastReduction || 0) + 0.08 * lvl; },
      },
    ],
  },
  {
    id: 'mobility',
    name: '机动线',
    color: '#58a6ff',
    nodes: [
      {
        id: 'mob_speed', name: '移动加速', desc: '移速+8',
        maxLevel: 3, costBase: 40, costPerLevel: 25,
        apply: (lvl, stats) => { stats.speed += 8 * lvl; },
      },
      {
        id: 'mob_pickup', name: '拾取范围', desc: '拾取范围+20%',
        maxLevel: 2, costBase: 30, costPerLevel: 25,
        apply: (lvl, stats) => { stats.pickupRange = (stats.pickupRange || 1) + 0.2 * lvl; },
      },
      {
        id: 'mob_slowres', name: '减速抵抗', desc: '减速效果-20%',
        maxLevel: 2, costBase: 30, costPerLevel: 20,
        apply: (lvl, stats) => { stats.slowResist += 0.2 * lvl; },
      },
      {
        id: 'mob_escape', name: '危机推进', desc: '低血量时移速+10%',
        maxLevel: 3, costBase: 45, costPerLevel: 30,
        apply: (lvl, stats) => { stats.lowHpSpeed = (stats.lowHpSpeed || 0) + 0.1 * lvl; },
      },
    ],
  },
  {
    id: 'firepower',
    name: '火控线',
    color: '#d29922',
    nodes: [
      {
        id: 'fp_damage', name: '火力强化', desc: '基础伤害+5',
        maxLevel: 3, costBase: 50, costPerLevel: 30,
        apply: (lvl, stats) => { stats.damage += 5 * lvl; },
      },
      {
        id: 'fp_firerate', name: '射速提升', desc: '射速间隔-0.05s',
        maxLevel: 3, costBase: 45, costPerLevel: 30,
        apply: (lvl, stats) => { stats.fireRateBonus += 0.05 * lvl; },
      },
      {
        id: 'fp_ammotime', name: '火力弹延长', desc: '火力弹+3秒',
        maxLevel: 2, costBase: 40, costPerLevel: 35,
        apply: (lvl, stats) => { stats.ammoDurationBonus += 3 * lvl; },
      },
      {
        id: 'fp_speed', name: '弹速提升', desc: '子弹速度+10%',
        maxLevel: 3, costBase: 45, costPerLevel: 35,
        apply: (lvl, stats) => { stats.bulletSpeedMult = (stats.bulletSpeedMult || 1) + 0.1 * lvl; },
      },
    ],
  },
  {
    id: 'tactics',
    name: '战术线',
    color: '#bc8cff',
    nodes: [
      {
        id: 'tac_loot', name: '战利品嗅觉', desc: '装备掉落率+10%',
        maxLevel: 3, costBase: 55, costPerLevel: 35,
        apply: (lvl, stats) => { stats.equipDropBonus = (stats.equipDropBonus || 0) + 0.1 * lvl; },
      },
      {
        id: 'tac_bonus', name: '红箱偏置', desc: '附加属性装备概率+8%',
        maxLevel: 3, costBase: 60, costPerLevel: 40,
        apply: (lvl, stats) => { stats.bonusEquipChance = (stats.bonusEquipChance || 0) + 0.08 * lvl; },
      },
      {
        id: 'tac_vision', name: '战场感知', desc: '索敌范围+24',
        maxLevel: 2, costBase: 45, costPerLevel: 30,
        apply: (lvl, stats) => { stats.lockRange += 24 * lvl; },
      },
      {
        id: 'tac_ammo', name: '补给整备', desc: '火力弹持续时间+2秒',
        maxLevel: 3, costBase: 40, costPerLevel: 25,
        apply: (lvl, stats) => { stats.ammoDurationBonus += 2 * lvl; },
      },
    ],
  },
];

// ---------- STAGES ----------
const STAGES = [
  {
    id: 'stage_1', name: '新手训练', desc: '消灭来袭的轻型追击车',
    time: 120, enemies: ['chaser'], difficulty: 1,
    spawnRate: 1.8, maxEnemies: 8, drops: ['common'],
    enemyHpMult: 1.0, enemyDmgMult: 1.0,
  },
  {
    id: 'stage_2', name: '炮台封锁', desc: '躲避炮台交叉火力',
    time: 120, enemies: ['chaser', 'turret'], difficulty: 1.2,
    spawnRate: 1.5, maxEnemies: 10, drops: ['common', 'common'],
    enemyHpMult: 1.1, enemyDmgMult: 1.1,
  },
  {
    id: 'stage_3', name: '导弹试验场', desc: '注意定点火箭打击',
    time: 130, enemies: ['chaser', 'turret', 'missile'], difficulty: 1.5,
    spawnRate: 1.3, maxEnemies: 12, drops: ['common', 'rare'],
    enemyHpMult: 1.2, enemyDmgMult: 1.2,
  },
  {
    id: 'stage_4', name: '精英重炮', desc: '精英单位首次登场',
    time: 150, enemies: ['chaser', 'turret', 'missile', 'elite'], difficulty: 2.0,
    spawnRate: 1.2, maxEnemies: 14, drops: ['common', 'rare'],
    enemyHpMult: 1.3, enemyDmgMult: 1.3,
  },
  {
    id: 'stage_5', name: '高压围堵', desc: '最终挑战，生存到底',
    time: 180, enemies: ['chaser', 'turret', 'missile', 'elite'], difficulty: 2.5,
    spawnRate: 1.0, maxEnemies: 18, drops: ['common', 'rare', 'rare'],
    enemyHpMult: 1.5, enemyDmgMult: 1.4,
  },
];

// ---------- DEFAULT TANK STATS ----------
function defaultTankStats() {
  return {
    maxHp: 100,
    speed: 120,
    damage: 15,
    fireRate: 0.4, // seconds between shots
    fireRange: 300,
    lockSpeed: 1.0,
    lockRange: 300,
    turnRate: 3.0,
    dmgReduction: 0,
    shield: 0,
    shieldRegen: 0,
    collisionReduction: 0,
    ammoDurationBonus: 0,
    pickupRange: 1.0,
    killHeal: 0,
    slowResist: 0,
    fireRateBonus: 0,
    bulletSpeedMult: 1.0,
    blastDamageMult: 1.0,
    blastReduction: 0,
    lowHpSpeed: 0,
    equipDropBonus: 0,
    bonusEquipChance: 0,
  };
}

// ---------- HELPER ----------
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
function angleBetween(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
