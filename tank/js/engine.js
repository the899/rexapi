// ============================================================
// CORE GAME ENGINE — canvas, game loop, entities, combat
// ============================================================

const BATTLE_ASSET_PATH = 'assets/generated/';
const BATTLE_ASSETS = {
  tanks: {
    player: { src: 'player_tank.png', w: 34, h: 56 },
    playerLight: { src: 'player_tank_light.png', w: 31, h: 58 },
    playerHeavy: { src: 'player_tank_heavy.png', w: 42, h: 60 },
    playerAssault: { src: 'player_tank_assault.png', w: 35, h: 62 },
    playerShield: { src: 'player_tank_shield.png', w: 40, h: 62 },
    playerSpeed: { src: 'player_tank_speed.png', w: 37, h: 62 },
    chaser: { src: 'enemy_chaser.png', w: 31, h: 54 },
    turret: { src: 'enemy_turret.png', w: 36, h: 58 },
    missile: { src: 'enemy_missile.png', w: 31, h: 60 },
    elite: { src: 'enemy_elite.png', w: 44, h: 62 },
  },
  obstacles: {
    wall: { src: 'wall_block.png' },
    crate: { src: 'crate.png' },
  },
  pickups: {
    equipBox: { src: 'equip_box_gold.png', w: 48, h: 48 },
    equipBoxBonus: { src: 'equip_box_bonus.png', w: 50, h: 50 },
  },
  bullets: {
    basic: { src: 'bullet_basic.png', w: 30, h: 13 },
    enemy: { src: 'bullet_burst.png', w: 24, h: 12 },
    rocket: { src: 'bullet_rocket.png', w: 34, h: 13 },
    pierce: { src: 'bullet_pierce.png', w: 34, h: 12 },
    burst: { src: 'bullet_burst.png', w: 31, h: 14 },
    emp: { src: 'bullet_emp.png', w: 34, h: 13 },
  },
  terrain: {
    dirt: { src: 'terrain_ground_dirt.png' },
    grass: { src: 'terrain_ground_grass.png' },
    concrete: { src: 'terrain_ground_concrete.png' },
    scorched: { src: 'terrain_ground_scorched.png' },
    treeSingle: { src: 'terrain_tree_single.png', w: 58, h: 58 },
    treeCluster: { src: 'terrain_tree_cluster.png', w: 76, h: 54 },
    rockCluster: { src: 'terrain_rock_cluster.png', w: 58, h: 58 },
    bush: { src: 'terrain_bush.png', w: 48, h: 48 },
    crater: { src: 'terrain_crater.png', w: 58, h: 58 },
    sandbags: { src: 'terrain_sandbags.png', w: 70, h: 32 },
  },
  effects: {
    explosion: { src: 'hit_explosion.png', w: 52, h: 52 },
    shieldRing: { src: 'shield_ring_thin.png', w: 1024, h: 1024 },
  },
};

const TERRAIN_DECORATIONS = [];
const TANK_SHIELD_MASKS = {};

function loadBattleAssets() {
  for (const group of Object.values(BATTLE_ASSETS)) {
    for (const asset of Object.values(group)) {
      asset.img = new Image();
      asset.ready = false;
      asset.img.onload = () => { asset.ready = true; };
      asset.img.src = BATTLE_ASSET_PATH + asset.src;
    }
  }
}

loadBattleAssets();

// ---- Entity Constructors ----

function createPlayer(stats) {
  return {
    x: 400, y: 300,
    radius: 14,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    shield: stats.shield || 0,
    maxShield: stats.shield || 0,
    speed: stats.speed,
    damage: stats.damage,
    fireRate: stats.fireRate,
    fireRange: stats.fireRange,
    lockSpeed: stats.lockSpeed,
    lockRange: stats.lockRange,
    turnRate: stats.turnRate,
    dmgReduction: stats.dmgReduction,
    shieldRegen: stats.shieldRegen || 0,
    collisionReduction: stats.collisionReduction,
    ammoDurationBonus: stats.ammoDurationBonus || 0,
    pickupRange: stats.pickupRange || 1.0,
    killHeal: stats.killHeal || 0,
    slowResist: stats.slowResist || 0,
    bulletSpeedMult: stats.bulletSpeedMult || 1.0,
    blastDamageMult: stats.blastDamageMult || 1.0,
    blastReduction: stats.blastReduction || 0,
    lowHpSpeed: stats.lowHpSpeed || 0,
    equipDropBonus: stats.equipDropBonus || 0,
    bonusEquipChance: stats.bonusEquipChance || 0,
    turretAngle: 0,
    fireCooldown: 0,
    currentAmmo: null,
    ammoTimer: 0,
    kills: 0,
    alive: true,
    speedMult: 1,
    slowTimer: 0,
    recoilTimer: 0,
    muzzleTimer: 0,
    hitTimer: 0,
  };
}

function createBullet(x, y, angle, damage, speed, owner, opts) {
  opts = opts || {};
  return {
    x, y, angle,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: opts.radius || 4,
    damage,
    speed,
    owner,
    life: opts.life || 2.5,
    pierce: opts.pierce || false,
    pierceCount: opts.pierceCount || 3,
    explosion: opts.explosion || false,
    explosionRadius: opts.explosionRadius || 40,
    slowEffect: opts.slowEffect || 0,
    slowDuration: opts.slowDuration || 0,
    color: opts.color || '#ffd700',
    kind: opts.kind || 'standard',
    startX: opts.startX ?? x,
    startY: opts.startY ?? y,
    targetX: opts.targetX ?? x,
    targetY: opts.targetY ?? y,
    flightTime: opts.flightTime || 1,
    elapsed: opts.elapsed || 0,
    arcHeight: opts.arcHeight || 0,
    z: opts.z || 0,
    alive: true,
  };
}

function createEnemy(typeDef, x, y, stageMult) {
  return {
    id: typeDef.id,
    x, y,
    radius: typeDef.size || 14,
    hp: typeDef.hp * (stageMult || 1),
    maxHp: typeDef.hp * (stageMult || 1),
    speed: typeDef.speed,
    damage: typeDef.damage,
    color: typeDef.color,
    score: typeDef.score || 10,
    type: typeDef.type,
    alive: true,
    fireRate: typeDef.fireRate || 0,
    fireRange: typeDef.fireRange || 0,
    fireCooldown: rand(0, typeDef.fireRate || 1),
    muzzleTimer: 0,
    recoilTimer: 0,
    hitTimer: 0,
    projectileSpeed: typeDef.projectileSpeed || 200,
    rocketFlightTime: typeDef.rocketFlightTime || 1.15,
    rocketExplosionRadius: typeDef.rocketExplosionRadius || 34,
    burstCount: typeDef.burstCount || 1,
    burstSpread: typeDef.burstSpread || 0,
    slowMult: 1,
    slowTimer: 0,
    chargeTimer: 0,
  };
}

function createDrop(x, y, type) {
  return {
    x, y,
    radius: 8,
    type, // 'ammo' or 'equip'
    ammoType: type === 'ammo' ? AMMO_LIST[randInt(0, AMMO_LIST.length - 1)].id : null,
    equipDrop: type === 'equip' ? randomEquipDrop() : null,
    bobTimer: rand(0, Math.PI * 2),
    life: 15,
    alive: true,
  };
}

function randomEquipDrop() {
  const pool = Object.values(EQUIP_ITEMS).filter(i => i.rarity === 'common' || i.rarity === 'rare');
  const weighted = [];
  for (const item of pool) {
    const w = item.rarity === 'common' ? 3 : 1;
    for (let i = 0; i < w; i++) weighted.push(item);
  }
  const item = weighted[randInt(0, weighted.length - 1)];
  const bonusChance = clamp((item.rarity === 'rare' ? 0.35 : 0.2) + (game?.player?.bonusEquipChance || 0), 0, 0.85);
  return {
    id: item.id,
    bonus: Math.random() < bonusChance,
  };
}

// ---- Game State ----

let game = null;

function initGame(stageDef, playerStats) {
  game = {
    stage: stageDef,
    state: 'playing', // playing, victory, defeat
    time: 0,
    maxTime: stageDef.time,
    player: createPlayer(playerStats),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    effects: [],
    drops: [],
    spawnTimer: 0,
    spawnRate: stageDef.spawnRate || 1.5,
    maxEnemies: stageDef.maxEnemies || 10,
    eliteSpawned: false,
    elapsed: 0,
    completed: false,
    screenShake: 0,
    stats: {
      kills: 0,
      damageDealt: 0,
      damageTaken: 0,
      ammoCollected: 0,
      equipCollected: 0,
    },
  };

  // Place player at center
  game.player.x = MAP_W / 2;
  game.player.y = MAP_H / 2;
}

// ---- Constants ----
const MAP_W = 800;
const MAP_H = 600;
const OBSTACLES = [];

function generateObstacles() {
  OBSTACLES.length = 0;
  TERRAIN_DECORATIONS.length = 0;

  const walls = [
    { x: 170, y: 145, w: 160, h: 28 },
    { x: 630, y: 145, w: 160, h: 28 },
    { x: 170, y: 455, w: 160, h: 28 },
    { x: 630, y: 455, w: 160, h: 28 },
    { x: 400, y: 110, w: 36, h: 120 },
    { x: 400, y: 490, w: 36, h: 120 },
  ];
  for (const wall of walls) {
    OBSTACLES.push({ ...wall, type: 'wall', destructible: false, pierceDestructible: true, hp: 36, maxHp: 36, alive: true });
  }

  const center = { x: MAP_W / 2, y: MAP_H / 2, w: 190, h: 150 };
  for (let i = 0; i < 12; i++) {
    let x, y, tries = 0;
    const size = randInt(26, 38);
    do {
      x = rand(70, MAP_W - 70);
      y = rand(70, MAP_H - 70);
      tries++;
    } while (
      (rectOverlap({ x, y, w: size + 28, h: size + 28 }, center) ||
      OBSTACLES.some(o => o.alive && rectOverlap({ x, y, w: size + 18, h: size + 18 }, o))) &&
      tries < 40
    );
    if (tries < 40) {
      OBSTACLES.push({
        x,
        y,
        w: size,
        h: size,
        type: 'crate',
        destructible: true,
        hp: 22,
        maxHp: 22,
        alive: true,
      });
    }
  }

  generateTerrainDecorations();
}

function generateTerrainDecorations() {
  const blocked = [
    { x: MAP_W / 2, y: MAP_H / 2, w: 230, h: 190 },
    ...OBSTACLES.map(o => ({ x: o.x, y: o.y, w: o.w + 34, h: o.h + 34 })),
  ];
  const specs = [
    { key: 'treeSingle', count: 5, w: 58, h: 58, solid: true, destructible: true },
    { key: 'treeCluster', count: 3, w: 78, h: 58, solid: true, destructible: true },
    { key: 'rockCluster', count: 4, w: 58, h: 58, solid: true },
    { key: 'bush', count: 7, w: 48, h: 48, solid: true, destructible: true },
    { key: 'crater', count: 8, w: 58, h: 58, solid: false },
    { key: 'sandbags', count: 4, w: 70, h: 32, solid: true },
  ];

  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      let x, y, tries = 0;
      const rect = { x: 0, y: 0, w: spec.w, h: spec.h };
      do {
        x = rand(45, MAP_W - 45);
        y = rand(45, MAP_H - 45);
        rect.x = x;
        rect.y = y;
        tries++;
      } while ((
        blocked.some(b => rectOverlap(rect, b)) ||
        TERRAIN_DECORATIONS.some(d => rectOverlap(rect, { x: d.x, y: d.y, w: d.w + 18, h: d.h + 18 }))
      ) && tries < 50);

      if (tries < 50) {
        const deco = {
          key: spec.key,
          x,
          y,
          w: spec.w,
          h: spec.h,
          angle: rand(-0.18, 0.18),
          solid: spec.solid,
        };
        TERRAIN_DECORATIONS.push(deco);
        if (spec.solid || spec.destructible) {
          const destructibleTerrain = !!spec.destructible;
          const obstacle = {
            x,
            y,
            w: spec.w * (destructibleTerrain ? 0.82 : 0.58),
            h: spec.h * (destructibleTerrain ? 0.82 : 0.58),
            type: 'terrain',
            destructible: destructibleTerrain,
            blocksMovement: !destructibleTerrain,
            hp: destructibleTerrain ? 22 : undefined,
            maxHp: destructibleTerrain ? 22 : undefined,
            alive: true,
            deco,
          };
          deco.obstacle = obstacle;
          OBSTACLES.push(obstacle);
        }
      }
    }
  }
}

function rectOverlap(r1, r2) {
  return r1.x - r1.w/2 < r2.x + r2.w/2 &&
         r1.x + r1.w/2 > r2.x - r2.w/2 &&
         r1.y - r1.h/2 < r2.y + r2.h/2 &&
         r1.y + r1.h/2 > r2.y - r2.h/2;
}

function pointInRect(px, py, r) {
  return px >= r.x - r.w/2 && px <= r.x + r.w/2 &&
         py >= r.y - r.h/2 && py <= r.y + r.h/2;
}

function circleHitsObstacle(x, y, radius, obs) {
  if (!obs.alive) return false;
  const cx = clamp(x, obs.x - obs.w / 2, obs.x + obs.w / 2);
  const cy = clamp(y, obs.y - obs.h / 2, obs.y + obs.h / 2);
  return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < radius;
}

function moveWithObstacleCollision(entity, nx, ny) {
  nx = clamp(nx, EDGE_BUFFER, MAP_W - EDGE_BUFFER);
  ny = clamp(ny, EDGE_BUFFER, MAP_H - EDGE_BUFFER);

  let tryX = nx;
  let tryY = ny;
  for (const obs of OBSTACLES) {
    if (obs.blocksMovement === false) continue;
    if (!circleHitsObstacle(tryX, tryY, entity.radius, obs)) continue;

    const slideXBlocked = circleHitsObstacle(entity.x, tryY, entity.radius, obs);
    const slideYBlocked = circleHitsObstacle(tryX, entity.y, entity.radius, obs);
    if (!slideXBlocked) {
      tryX = entity.x;
    } else if (!slideYBlocked) {
      tryY = entity.y;
    } else {
      tryX = entity.x;
      tryY = entity.y;
    }
  }

  return { x: tryX, y: tryY };
}

function resolveEntityObstacleOverlap(entity) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const obs of OBSTACLES) {
      if (!obs.alive || obs.blocksMovement === false) continue;
      if (!circleHitsObstacle(entity.x, entity.y, entity.radius, obs)) continue;

      const dx = entity.x - obs.x;
      const dy = entity.y - obs.y;
      const overlapX = obs.w / 2 + entity.radius - Math.abs(dx);
      const overlapY = obs.h / 2 + entity.radius - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;

      if (overlapX < overlapY) {
        entity.x += (dx >= 0 ? 1 : -1) * (overlapX + 0.5);
      } else {
        entity.y += (dy >= 0 ? 1 : -1) * (overlapY + 0.5);
      }
      entity.x = clamp(entity.x, EDGE_BUFFER, MAP_W - EDGE_BUFFER);
      entity.y = clamp(entity.y, EDGE_BUFFER, MAP_H - EDGE_BUFFER);
      moved = true;
    }
    if (!moved) break;
  }
}

function hitObstacleWithBullet(bullet) {
  for (const obs of OBSTACLES) {
    if (!obs.alive) continue;
    if (!circleHitsObstacle(bullet.x, bullet.y, bullet.radius, obs)) continue;

    const pierceBreaksWall = bullet.owner === 'player' && bullet.pierce && obs.pierceDestructible;
    bullet.alive = false;
    addImpactBurst(bullet.x, bullet.y, bullet.angle, bullet, obs.destructible ? 'wood' : 'wall');
    addScreenShake(obs.destructible ? 1.5 : pierceBreaksWall ? 3.2 : 2.5);
    if (pierceBreaksWall) {
      obs.hp -= bullet.damage || 10;
      if (obs.hp <= 0) {
        obs.alive = false;
        game.effects.push({ x: obs.x, y: obs.y, size: Math.max(obs.w, obs.h) * 1.1, timer: 0.32, maxTimer: 0.32, alive: true });
        addImpactBurst(obs.x, obs.y, bullet.angle, bullet, 'wallBreak', 18);
        addScreenShake(4.5);
      }
      if (bullet.pierceCount > 0) {
        bullet.pierceCount--;
        bullet.alive = bullet.pierceCount > 0;
      }
      return true;
    }
    if (obs.destructible) {
      obs.hp -= bullet.damage || 10;
      if (obs.hp <= 0) {
        obs.alive = false;
        game.effects.push({ x: obs.x, y: obs.y, size: 42, timer: 0.24, maxTimer: 0.24, alive: true });
        addImpactBurst(obs.x, obs.y, bullet.angle, bullet, 'woodBreak', 14);
        addScreenShake(3);
        if (obs.type === 'crate' && Math.random() < 0.45) {
          game.drops.push(createDrop(obs.x, obs.y, Math.random() < 0.25 ? 'equip' : 'ammo'));
        }
      }
    }
    return true;
  }
  return false;
}

const EDGE_BUFFER = 30;

function addScreenShake(amount) {
  if (!game) return;
  game.screenShake = Math.min(12, Math.max(game.screenShake || 0, amount));
}

function addImpactBurst(x, y, angle, bullet, kind, count) {
  if (!game) return;
  const isEmp = bullet?.slowEffect > 0;
  const isExplosive = bullet?.explosion;
  const isPierce = bullet?.pierce;
  const sparkCount = count || (isExplosive ? 16 : isEmp ? 12 : isPierce ? 9 : 7);
  const color = isEmp ? '#6bcbff' : kind === 'wood' || kind === 'woodBreak' ? '#d2995a' : isExplosive ? '#ff7b2e' : isPierce ? '#dff9ff' : '#ffd166';
  for (let i = 0; i < sparkCount; i++) {
    const spread = rand(-1.35, 1.35);
    const a = (angle || 0) + Math.PI + spread;
    const speed = rand(kind === 'woodBreak' ? 60 : 35, kind === 'woodBreak' ? 150 : 110);
    game.effects.push({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      size: rand(2, isExplosive ? 5 : 4),
      color,
      timer: rand(0.14, kind === 'woodBreak' ? 0.34 : 0.24),
      maxTimer: 0.34,
      alive: true,
    });
  }
}

function addTankDestroyFx(x, y, radius, angle) {
  game.effects.push({ x, y, size: radius * 3.6, timer: 0.48, maxTimer: 0.48, alive: true });
  addImpactBurst(x, y, angle || 0, { explosion: true }, 'armorBreak', 18);
  addScreenShake(radius > 20 ? 7 : 4);
}

function damagePlayer(rawDmg, angle, shake = 4, kind = 'direct') {
  const p = game?.player;
  if (!p?.alive) return;
  p.hitTimer = 0.18;
  addScreenShake(shake);
  const typedDmg = kind === 'explosive' ? rawDmg * (1 - (p.blastReduction || 0)) : rawDmg;
  const reduced = Math.max(1, typedDmg - (p.dmgReduction || 0));
  if (p.shield > 0) {
    const shieldAbsorb = Math.min(p.shield, reduced);
    p.shield -= shieldAbsorb;
    p.hp -= reduced - shieldAbsorb;
  } else {
    p.hp -= reduced;
  }
  game.stats.damageTaken += reduced;

  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    addTankDestroyFx(p.x, p.y, p.radius, angle || 0);
    endGame(false);
  }
}

// ---- Update ----

function updateGame(dt) {
  if (!game || game.state !== 'playing') return;

  const p = game.player;
  game.elapsed += dt;
  game.time += dt;
  game.screenShake = Math.max(0, (game.screenShake || 0) - dt * 18);

  if (p.recoilTimer > 0) p.recoilTimer = Math.max(0, p.recoilTimer - dt);
  if (p.muzzleTimer > 0) p.muzzleTimer = Math.max(0, p.muzzleTimer - dt);
  if (p.hitTimer > 0) p.hitTimer = Math.max(0, p.hitTimer - dt);

  // --- Player movement ---
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy = -1;
  if (keys['s'] || keys['arrowdown']) dy = 1;
  if (keys['a'] || keys['arrowleft']) dx = -1;
  if (keys['d'] || keys['arrowright']) dx = 1;

  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  const lowHpBoost = p.hp / p.maxHp <= 0.35 ? (p.lowHpSpeed || 0) : 0;
  const moveSpeed = p.speed * (p.speedMult || 1) * (1 + lowHpBoost);
  let nx = p.x + dx * moveSpeed * dt;
  let ny = p.y + dy * moveSpeed * dt;

  const playerMove = moveWithObstacleCollision(p, nx, ny);
  p.x = playerMove.x;
  p.y = playerMove.y;
  resolveEntityObstacleOverlap(p);

  // Slow recovery
  if (p.slowTimer > 0) {
    p.slowTimer -= dt;
    if (p.slowTimer <= 0) {
      p.speedMult = 1;
      p.slowTimer = 0;
    }
  }

  // Shield regen
  if (p.shieldRegen > 0 && p.shield < p.maxShield) {
    p.shield = Math.min(p.maxShield, p.shield + p.shieldRegen * dt);
  }

  // --- Auto-aim ---
  let targetEnemy = null;
  let targetDist = Infinity;
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = dist(p, e);
    if (d < p.lockRange && d < targetDist) {
      targetDist = d;
      targetEnemy = e;
    }
  }

  if (targetEnemy) {
    const targetAngle = angleBetween(p, targetEnemy);
    // Smooth turret rotation
    let diff = targetAngle - p.turretAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.turretAngle += clamp(diff, -p.turnRate * p.lockSpeed * dt, p.turnRate * p.lockSpeed * dt);
  }

  // --- Auto-fire ---
  p.fireCooldown -= dt;
  if (p.fireCooldown <= 0 && targetEnemy && targetDist < p.fireRange) {
    firePlayerBullet();
    p.fireCooldown = p.fireRate;
  }

  // --- Ammo timer ---
  if (p.currentAmmo) {
    p.ammoTimer -= dt;
    if (p.ammoTimer <= 0) {
      p.currentAmmo = null;
    }
  }

  // --- Spawn enemies ---
  const difficultyMult = game.stage.difficulty || 1;
  const spawnInterval = (game.spawnRate || 1.5) / difficultyMult;
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    const liveCount = game.enemies.filter(e => e.alive).length;
    if (liveCount < game.maxEnemies) {
      spawnEnemy();
    }
    game.spawnTimer = spawnInterval;
  }

  // Late-stage elite
  const timeLeft = game.maxTime - game.time;
  if (timeLeft < 30 && !game.eliteSpawned && game.stage.enemies.includes('elite')) {
    spawnElite();
    game.eliteSpawned = true;
  }

  // --- Update enemies ---
  for (const e of game.enemies) {
    if (!e.alive) continue;

    // Slow recovery
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) {
        e.slowMult = 1;
        e.slowTimer = 0;
      }
    }

    // Enemy AI
    if (e.muzzleTimer > 0) {
      e.muzzleTimer = Math.max(0, e.muzzleTimer - dt);
    }
    if (e.recoilTimer > 0) e.recoilTimer = Math.max(0, e.recoilTimer - dt);
    if (e.hitTimer > 0) e.hitTimer = Math.max(0, e.hitTimer - dt);

  if (e.type === 'chaser') {
      const a = angleBetween(e, p);
      const move = moveWithObstacleCollision(
        e,
        e.x + Math.cos(a) * e.speed * e.slowMult * dt,
        e.y + Math.sin(a) * e.speed * e.slowMult * dt
      );
      e.x = move.x;
      e.y = move.y;
      const d = dist(e, p);
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && d < 260) {
        fireEnemyBullet(e, a);
        e.fireCooldown = 1.6;
      }
    } else if (e.type === 'missile') {
      const a = angleBetween(e, p);
      const d = dist(e, p);
      if (d > 100) {
        const move = moveWithObstacleCollision(
          e,
          e.x + Math.cos(a) * e.speed * e.slowMult * dt,
          e.y + Math.sin(a) * e.speed * e.slowMult * dt
        );
        e.x = move.x;
        e.y = move.y;
      }
      // Fire an arcing rocket at the player's current position.
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && d < e.fireRange) {
        fireEnemyRocket(e, p.x, p.y);
        e.fireCooldown = e.fireRate;
      }
    } else if (e.type === 'turret') {
      e.fireCooldown -= dt;
      const d = dist(e, p);
      if (e.fireCooldown <= 0 && d < e.fireRange) {
        const a = angleBetween(e, p);
        fireEnemyBullet(e, a);
        e.fireCooldown = e.fireRate;
      }
    } else if (e.type === 'elite') {
      const a = angleBetween(e, p);
      const d = dist(e, p);
      if (d > 120) {
        const move = moveWithObstacleCollision(
          e,
          e.x + Math.cos(a) * e.speed * e.slowMult * dt,
          e.y + Math.sin(a) * e.speed * e.slowMult * dt
        );
        e.x = move.x;
        e.y = move.y;
      }
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && d < e.fireRange) {
        const baseAngle = angleBetween(e, p);
        const count = e.burstCount || 3;
        const spread = e.burstSpread || 0.3;
        for (let i = 0; i < count; i++) {
          const aOff = baseAngle + (i - (count-1)/2) * spread;
          fireEnemyBullet(e, aOff);
        }
        e.fireCooldown = e.fireRate;
      }
    }

    // Clamp enemy to map
    e.x = clamp(e.x, 10, MAP_W - 10);
    e.y = clamp(e.y, 10, MAP_H - 10);
  }

  // --- Update bullets ---
  for (const b of game.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitObstacleWithBullet(b)) continue;
    if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) {
      b.alive = false;
    }
  }

  for (const b of game.enemyBullets) {
    if (!b.alive) continue;
    if (b.kind === 'rocket') {
      b.elapsed += dt;
      const t = clamp(b.elapsed / b.flightTime, 0, 1);
      b.x = b.startX + (b.targetX - b.startX) * t;
      b.y = b.startY + (b.targetY - b.startY) * t;
      b.z = Math.sin(t * Math.PI) * b.arcHeight;
      b.angle = Math.atan2(b.targetY - b.startY, b.targetX - b.startX);
      b.life -= dt;
      if (t >= 1) {
        b.alive = false;
        addImpactBurst(b.targetX, b.targetY, b.angle, { explosion: true }, 'rocketImpact', 18);
        game.effects.push({ x: b.targetX, y: b.targetY, size: b.explosionRadius * 1.9, timer: 0.28, maxTimer: 0.28, alive: true });
        addScreenShake(5);
        if (dist({ x: b.targetX, y: b.targetY }, p) < b.explosionRadius + p.radius) {
          damagePlayer(b.damage || 10, b.angle, 5, 'explosive');
        }
      }
      continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitObstacleWithBullet(b)) continue;
    if (b.life <= 0 || b.x < 0 || b.x > MAP_W || b.y < 0 || b.y > MAP_H) {
      b.alive = false;
    }
  }

  for (const fx of game.effects) {
    fx.timer -= dt;
    if (fx.kind === 'spark') {
      fx.x += fx.vx * dt;
      fx.y += fx.vy * dt;
      fx.vx *= 0.88;
      fx.vy *= 0.88;
    }
    if (fx.timer <= 0) fx.alive = false;
  }

  // --- Collision: player bullets vs enemies ---
  for (const b of game.bullets) {
    if (!b.alive) continue;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      if (dist(b, e) < b.radius + e.radius) {
        // Hit
        const hitDmg = b.damage;
        e.hp -= hitDmg;
        e.hitTimer = b.explosion ? 0.22 : 0.14;
        b.alive = false;
        game.effects.push({ x: b.x, y: b.y, size: b.explosion ? 58 : 34, timer: b.explosion ? 0.36 : 0.18, maxTimer: b.explosion ? 0.36 : 0.18, alive: true });
        addImpactBurst(b.x, b.y, b.angle, b);
        addScreenShake(b.explosion ? 5 : b.pierce ? 2.8 : 2);
        game.stats.damageDealt += hitDmg;

        // Slow effect
        if (b.slowEffect > 0) {
          e.slowMult = 1 - b.slowEffect;
          e.slowTimer = b.slowDuration;
        }

        // Explosion
        if (b.explosion) {
          applyExplosion(b.x, b.y, b.explosionRadius, b.damage * 0.5);
        }

        // Pierce
        if (b.pierce) {
          b.pierceCount--;
          if (b.pierceCount > 0) {
            b.alive = true;
          }
        }

        if (e.hp <= 0) {
          e.alive = false;
          addTankDestroyFx(e.x, e.y, e.radius, b.angle);
          game.stats.kills++;
          p.kills++;
          // Kill heal
          if (p.killHeal > 0 && Math.random() < p.killHeal) {
            p.hp = Math.min(p.maxHp, p.hp + 10);
          }
          // Drop chance
          maybeDrop(e.x, e.y, e.type);
        }
        break;
      }
    }
  }

  // --- Collision: enemy bullets vs player ---
  for (const b of game.enemyBullets) {
    if (!b.alive) continue;
    if (b.kind === 'rocket') continue;
    if (dist(b, p) < b.radius + p.radius) {
      b.alive = false;
      addImpactBurst(b.x, b.y, b.angle, b);
      damagePlayer(b.damage || 10, b.angle, 4);
    }
  }

  // --- Collision: enemy ram player ---
  for (const e of game.enemies) {
    if (!e.alive) continue;
    if (dist(e, p) < e.radius + p.radius) {
      // Push player away
      const a = angleBetween(e, p);
      const beforeX = p.x;
      const beforeY = p.y;
      const push = moveWithObstacleCollision(p, p.x + Math.cos(a) * 3.5, p.y + Math.sin(a) * 3.5);
      p.x = push.x;
      p.y = push.y;
      resolveEntityObstacleOverlap(p);
      if (Math.abs(p.x - beforeX) + Math.abs(p.y - beforeY) < 0.4) {
        const enemyPush = moveWithObstacleCollision(e, e.x - Math.cos(a) * 2.5, e.y - Math.sin(a) * 2.5);
        e.x = enemyPush.x;
        e.y = enemyPush.y;
        resolveEntityObstacleOverlap(e);
      }

      // Collision damage (with iframe)
      if (p.slowTimer <= 0) {
        const rawDmg = e.damage || 5;
        const reduced = Math.max(1, rawDmg - (p.collisionReduction || 0));
        p.hp -= reduced;
        p.hitTimer = 0.16;
        addScreenShake(3);
        game.stats.damageTaken += reduced;
        p.slowTimer = 0.3; // brief iframe via slow timer reuse
        if (p.hp <= 0) {
          p.hp = 0;
          p.alive = false;
          addTankDestroyFx(p.x, p.y, p.radius, a);
          endGame(false);
        }
      }
    }
  }

  // --- Collect drops ---
  for (const drop of game.drops) {
    if (!drop.alive) continue;
    drop.life -= dt;
    if (drop.life <= 0) {
      drop.alive = false;
      continue;
    }
    const pickupRange = 30 * (p.pickupRange || 1);
    if (dist(p, drop) < p.radius + pickupRange) {
      if (drop.type === 'ammo' && drop.ammoType) {
        const ammoDef = AMMO_DEFS[drop.ammoType];
        if (ammoDef) {
          p.currentAmmo = ammoDef;
          p.ammoTimer = ammoDef.duration + (p.ammoDurationBonus || 0);
          game.stats.ammoCollected++;
        }
      } else if (drop.type === 'equip' && drop.equipDrop) {
        const equipDrop = drop.equipDrop;
        const item = equipDrop ? EQUIP_ITEMS[equipDrop.id] : null;
        if (item) {
          const inv = gameState.inventory;
          if (!inv[equipDrop.id]) inv[equipDrop.id] = { owned: true, count: 0, bonusCount: 0 };
          inv[equipDrop.id].count = (inv[equipDrop.id].count || 0) + 1;
          if (equipDrop.bonus) {
            inv[equipDrop.id].bonusCount = (inv[equipDrop.id].bonusCount || 0) + 1;
          }
          inv[equipDrop.id].owned = true;
          game.stats.equipCollected++;
          addBattleMessage(`获得 ${item.name}${equipDrop.bonus ? '（附加属性）' : ''}`, '#58a6ff');
        }
      }
      drop.alive = false;
    }
  }

  // --- Cleanup ---
  game.bullets = game.bullets.filter(b => b.alive);
  game.enemyBullets = game.enemyBullets.filter(b => b.alive);
  game.enemies = game.enemies.filter(e => e.alive);
  game.drops = game.drops.filter(d => d.alive);
  game.effects = game.effects.filter(fx => fx.alive);

  // --- Check win ---
  if (game.time >= game.maxTime && game.state === 'playing') {
    endGame(true);
  }
}

function applyExplosion(x, y, radius, damage) {
  game.effects.push({ x, y, size: Math.max(48, radius * 1.35), timer: 0.42, maxTimer: 0.42, alive: true });
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const d = dist({x, y}, e);
    if (d < radius) {
      const falloff = 1 - d / radius;
      e.hp -= damage * falloff;
      if (e.hp <= 0) {
        e.alive = false;
        addTankDestroyFx(e.x, e.y, e.radius, angleBetween({ x, y }, e));
        game.stats.kills++;
        game.player.kills++;
        maybeDrop(e.x, e.y, e.type);
      }
    }
  }
}

function maybeDrop(x, y, enemyType) {
  // Higher drop chance for elites
  const baseChance = clamp((enemyType === 'elite' ? 0.6 : 0.18) + (game?.player?.equipDropBonus || 0) * 0.35, 0, 0.8);
  if (Math.random() < baseChance) {
    const isEquip = Math.random() < clamp(0.35 + (game?.player?.equipDropBonus || 0), 0, 0.75);
    const drop = createDrop(x, y, isEquip ? 'equip' : 'ammo');
    game.drops.push(drop);
  }
}

function spawnEnemy() {
  const stage = game.stage;
  const pool = stage.enemies;
  const typeId = pool[randInt(0, pool.length - 1)];
  const def = ENEMY_DEFS[typeId];
  if (!def) return;

  // Spawn at edge
  let x, y;
  const side = randInt(0, 3);
  switch (side) {
    case 0: x = -10; y = rand(20, MAP_H - 20); break;
    case 1: x = MAP_W + 10; y = rand(20, MAP_H - 20); break;
    case 2: x = rand(20, MAP_W - 20); y = -10; break;
    case 3: x = rand(20, MAP_W - 20); y = MAP_H + 10; break;
  }

  const e = createEnemy(def, x, y, stage.enemyHpMult || 1);
  e.damage *= (stage.enemyDmgMult || 1);
  game.enemies.push(e);
}

function spawnElite() {
  const def = ENEMY_DEFS.elite;
  if (!def) return;
  const x = rand(50, MAP_W - 50);
  const y = rand(50, MAP_H - 50);
  const e = createEnemy(def, x, y, game.stage.enemyHpMult || 1);
  e.damage *= (game.stage.enemyDmgMult || 1);
  // Add a message
  addBattleMessage('⚠ 精英重炮登场！', '#ff4444');
  game.enemies.push(e);
}

function firePlayerBullet() {
  const p = game.player;
  const angle = p.turretAngle;
  const ammo = p.currentAmmo;
  const dmg = p.damage;
  p.recoilTimer = ammo?.explosion ? 0.18 : 0.12;
  p.muzzleTimer = ammo?.explosion ? 0.18 : 0.13;
  addScreenShake(ammo?.explosion ? 2.4 : ammo?.pierce ? 1.5 : 0.9);

  if (ammo) {
    // Ammo-specific firing
    const shots = ammo.shots || 1;
    const spread = ammo.spread || 0;
    const speed = 270 * (ammo.speedMult || 1) * (p.bulletSpeedMult || 1);
    for (let i = 0; i < shots; i++) {
      const aOff = angle + (i - (shots - 1) / 2) * spread;
      const explosionDamageBonus = ammo.explosion ? (p.blastDamageMult || 1) : 1;
      const b = createBullet(p.x, p.y, aOff, dmg * (ammo.damageMult || 1) * explosionDamageBonus, speed, 'player', {
        radius: 5,
        color: ammo.color || '#ffd700',
        pierce: ammo.pierce || false,
        pierceCount: ammo.pierce ? 3 : 0,
        explosion: ammo.explosion || false,
        explosionRadius: ammo.explosionRadius || 40,
        slowEffect: ammo.slowEffect || 0,
        slowDuration: ammo.slowDuration || 0,
      });
      game.bullets.push(b);
    }
  } else {
    // Default shot
    const b = createBullet(p.x, p.y, angle, dmg, 245 * (p.bulletSpeedMult || 1), 'player', { color: '#ffd700' });
    game.bullets.push(b);
  }
}

function fireEnemyBullet(enemy, angle) {
  const speed = enemy.projectileSpeed || 200;
  const dmg = enemy.damage || 10;
  const barrelLen = enemy.type === 'elite' ? 40 : enemy.type === 'chaser' ? 28 : 32;
  const b = createBullet(
    enemy.x + Math.cos(angle) * barrelLen,
    enemy.y + Math.sin(angle) * barrelLen,
    angle,
    dmg,
    speed,
    'enemy',
    {
    radius: enemy.type === 'elite' ? 5 : 4,
    color: enemy.type === 'elite' ? '#ff4444' : '#ff8844',
    life: 3.0,
    }
  );
  enemy.muzzleTimer = 0.16;
  enemy.recoilTimer = enemy.type === 'elite' ? 0.2 : 0.13;
  addScreenShake(enemy.type === 'elite' ? 4 : 1.6);
  game.enemyBullets.push(b);
}

function fireEnemyRocket(enemy, targetX, targetY) {
  const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  const barrelLen = 32;
  const startX = enemy.x + Math.cos(angle) * barrelLen;
  const startY = enemy.y + Math.sin(angle) * barrelLen;
  const flightTime = enemy.rocketFlightTime || 1.15;
  const distanceToTarget = Math.hypot(targetX - startX, targetY - startY);
  const arcHeight = clamp(distanceToTarget * 0.22, 32, 58);
  const b = createBullet(startX, startY, angle, enemy.damage || 14, 0, 'enemy', {
    kind: 'rocket',
    radius: 6,
    color: '#ff6b35',
    explosion: true,
    explosionRadius: enemy.rocketExplosionRadius || 34,
    life: flightTime + 0.2,
    startX,
    startY,
    targetX,
    targetY,
    flightTime,
    arcHeight,
  });
  enemy.muzzleTimer = 0.22;
  enemy.recoilTimer = 0.2;
  addScreenShake(1.2);
  game.enemyBullets.push(b);
}

function endGame(victory) {
  if (!game) return;
  game.state = victory ? 'victory' : 'defeat';
  game.completed = victory;

  // Settlement rewards
  const stage = game.stage;
  let goldReward = 0;
  let techReward = 0;
  let equipRewards = [];

  if (victory) {
    goldReward = 20 + game.stats.kills * 2;
    techReward = 5 + Math.floor(game.stats.kills / 5);
    // Guaranteed equipment drop
    const equipDrop = randomEquipDrop();
    const item = EQUIP_ITEMS[equipDrop.id];
    if (item) {
      equipRewards.push(equipDrop.id);
      const inv = gameState.inventory;
      if (!inv[equipDrop.id]) inv[equipDrop.id] = { owned: true, count: 0, bonusCount: 0 };
      inv[equipDrop.id].count = (inv[equipDrop.id].count || 0) + 1;
      if (equipDrop.bonus) {
        inv[equipDrop.id].bonusCount = (inv[equipDrop.id].bonusCount || 0) + 1;
      }
      inv[equipDrop.id].owned = true;
    }
    // Mark stage completed
    if (!gameState.completedStages.includes(stage.id)) {
      gameState.completedStages.push(stage.id);
    }
  } else {
    goldReward = 5 + Math.floor(game.stats.kills);
    techReward = 1 + Math.floor(game.stats.kills / 10);
  }

  gameState.gold += goldReward;
  gameState.techPoints += techReward;
  gameState.totalKills += game.stats.kills;

  showSettlement(victory, goldReward, techReward, equipRewards);
  saveGame();
}

function drawTankSprite(ctx, spriteKey, x, y, angle, scaleMult = 1) {
  const sprite = BATTLE_ASSETS.tanks[spriteKey];
  if (!sprite || !sprite.ready) return false;
  const drawW = sprite.w * scaleMult;
  const drawH = sprite.h * scaleMult;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.drawImage(sprite.img, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
  return true;
}

function drawTankShieldAura(ctx, spriteKey, x, y, angle, scaleMult = 1) {
  const sprite = BATTLE_ASSETS.tanks[spriteKey];
  if (!sprite || !sprite.ready) return false;
  const mask = getTankShieldMask(spriteKey);
  if (!mask) return false;
  const drawW = sprite.w * scaleMult;
  const drawH = sprite.h * scaleMult;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI / 2);
  ctx.globalCompositeOperation = 'screen';

  ctx.globalAlpha = 0.5;
  ctx.shadowColor = 'rgba(80, 225, 255, 1)';
  ctx.shadowBlur = 18;
  ctx.drawImage(mask, -drawW / 2, -drawH / 2, drawW, drawH);

  ctx.globalAlpha = 0.24;
  ctx.shadowBlur = 4;
  ctx.drawImage(mask, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
  return true;
}

function getTankShieldMask(spriteKey) {
  if (TANK_SHIELD_MASKS[spriteKey]) return TANK_SHIELD_MASKS[spriteKey];
  const sprite = BATTLE_ASSETS.tanks[spriteKey];
  if (!sprite?.ready) return null;

  const sourceW = sprite.img.naturalWidth || sprite.w;
  const sourceH = sprite.img.naturalHeight || sprite.h;
  const canvas = document.createElement('canvas');
  canvas.width = sourceW;
  canvas.height = sourceH;
  const c = canvas.getContext('2d');
  c.drawImage(sprite.img, 0, 0, sourceW, sourceH);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = 'rgba(76, 224, 255, 0.95)';
  c.fillRect(0, 0, sourceW, sourceH);
  TANK_SHIELD_MASKS[spriteKey] = canvas;
  return canvas;
}

function drawAssetImage(ctx, asset, x, y, w, h, angle = 0, alpha = 1) {
  if (!asset || !asset.ready) return false;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(asset.img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

function drawMuzzleFlash(ctx, x, y, angle, power, color = '#ffcf5a') {
  const len = 22 * power;
  const width = 9 * power;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 * power;
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, '#fff7c2');
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, 'rgba(255,94,31,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.38, -width);
  ctx.lineTo(len, 0);
  ctx.lineTo(len * 0.38, width);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getTechLevel(nodeId) {
  return gameState?.techLevels?.[nodeId] || 0;
}

function getPlayerVisualMods() {
  const slots = gameState?.equipSlots || {};
  return {
    hull: slots.hull,
    cannon: slots.cannon,
    turret: slots.turretSys,
    tracks: slots.tracks,
    armor: slots.armor,
    chip: slots.chip,
    fire: getTechLevel('fp_damage') + getTechLevel('fp_firerate') + getTechLevel('fp_ammotime'),
    survival: getTechLevel('surv_hp') + getTechLevel('surv_shield') + getTechLevel('surv_collision'),
    mobility: getTechLevel('mob_speed') + getTechLevel('mob_pickup') + getTechLevel('mob_slowres'),
  };
}

function getPlayerTankSpriteKey() {
  const mods = getPlayerVisualMods();
  if (mods.armor === 'shield_armor' || mods.survival >= 3) return 'playerShield';
  if (mods.cannon === 'heavy_cannon' || mods.cannon === 'precision_cannon' || mods.fire >= 4) return 'playerAssault';
  if (mods.tracks === 'speed_tracks' || mods.tracks === 'maneuver_tracks' || mods.mobility >= 4) return 'playerSpeed';
  if (mods.hull === 'heavy_hull' || mods.armor === 'heavy_armor') return 'playerHeavy';
  if (mods.hull === 'light_hull') return 'playerLight';
  return 'player';
}

function drawPlayerUpgradeOverlays(ctx, x, y, angle, p, scale = 1) {
  const mods = getPlayerVisualMods();
  const chipOn = mods.chip;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  if (chipOn) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = mods.chip === 'life_chip' ? '#65e682' : mods.chip === 'magnet_chip' ? '#bc8cff' : '#ffd166';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(-6, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function getStageNumber() {
  const match = String(game?.stage?.id || '').match(/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function drawTiledGround(ctx) {
  const stageNo = getStageNumber();
  const tile = stageNo >= 5
    ? BATTLE_ASSETS.terrain.scorched
    : stageNo >= 4
      ? BATTLE_ASSETS.terrain.concrete
      : stageNo >= 2
        ? BATTLE_ASSETS.terrain.grass
        : BATTLE_ASSETS.terrain.dirt;

  if (tile && tile.ready) {
    const tileSize = 256;
    for (let y = 0; y < MAP_H; y += tileSize) {
      for (let x = 0; x < MAP_W; x += tileSize) {
        ctx.drawImage(tile.img, x, y, tileSize, tileSize);
      }
    }
  } else {
    ctx.fillStyle = '#263027';
    ctx.fillRect(0, 0, MAP_W, MAP_H);
  }

  if (BATTLE_ASSETS.terrain.scorched.ready) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let y = -50; y < MAP_H; y += 210) {
      for (let x = 70; x < MAP_W; x += 260) {
        ctx.drawImage(BATTLE_ASSETS.terrain.scorched.img, x, y, 150, 150);
      }
    }
    ctx.restore();
  }
}

function drawTerrainDecoration(ctx, deco) {
  if (deco.obstacle && !deco.obstacle.alive) return;
  const asset = BATTLE_ASSETS.terrain[deco.key];
  if (!drawAssetImage(ctx, asset, deco.x, deco.y, deco.w, deco.h, deco.angle, deco.solid ? 1 : 0.82)) {
    ctx.save();
    ctx.globalAlpha = deco.solid ? 1 : 0.65;
    ctx.fillStyle = deco.solid ? '#4f6f4b' : '#243424';
    ctx.beginPath();
    ctx.ellipse(deco.x, deco.y, deco.w / 2, deco.h / 2, deco.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function isFoliageCover(deco) {
  return deco && (deco.key === 'treeSingle' || deco.key === 'treeCluster' || deco.key === 'bush');
}

function getEntityFoliageVisibility(entity) {
  let visibility = 1;
  for (const deco of TERRAIN_DECORATIONS) {
    if (!isFoliageCover(deco)) continue;
    if (deco.obstacle && !deco.obstacle.alive) continue;

    const halfW = deco.w * 0.45;
    const halfH = deco.h * 0.45;
    const nx = Math.abs(entity.x - deco.x) / halfW;
    const ny = Math.abs(entity.y - deco.y) / halfH;
    const edgeProximity = Math.max(nx, ny);
    if (edgeProximity >= 1) continue;

    const fade = clamp((edgeProximity - 0.48) / 0.52, 0, 1);
    visibility = Math.min(visibility, fade);
  }
  return visibility;
}

function drawPixelHighlight(ctx, blocks, color) {
  ctx.fillStyle = color;
  for (const block of blocks) {
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
}

function drawTopDownTank(ctx, x, y, angle, opts) {
  const size = opts.size || 1;
  const hull = opts.hull || '#35c7ff';
  const hullDark = opts.hullDark || '#0d253f';
  const edge = opts.edge || '#ffffff';
  const highlight = opts.highlight || 'rgba(255,255,255,0.35)';
  const tread = opts.tread || '#111820';
  const gun = opts.gun || edge;
  const variant = opts.variant || 'standard';

  ctx.save();
  ctx.translate(x, y + 4 * size);
  ctx.scale(1.25 * size, 0.42 * size);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const treadW = 8 * size;
  const treadH = 36 * size;
  const bodyW = variant === 'elite' ? 38 * size : 32 * size;
  const bodyH = variant === 'chaser' ? 24 * size : 27 * size;

  ctx.fillStyle = tread;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.5 * size;
  ctx.fillRect(-bodyW / 2 - treadW + 2 * size, -treadH / 2, treadW, treadH);
  ctx.fillRect(bodyW / 2 - 2 * size, -treadH / 2, treadW, treadH);
  ctx.strokeRect(-bodyW / 2 - treadW + 2 * size, -treadH / 2, treadW, treadH);
  ctx.strokeRect(bodyW / 2 - 2 * size, -treadH / 2, treadW, treadH);

  ctx.fillStyle = edge;
  for (let i = -14; i <= 14; i += 7) {
    ctx.fillRect(-bodyW / 2 - treadW + 3 * size, i * size, treadW - 2 * size, 2 * size);
    ctx.fillRect(bodyW / 2 - 1 * size, i * size, treadW - 2 * size, 2 * size);
  }

  ctx.beginPath();
  if (variant === 'chaser') {
    ctx.moveTo(bodyW / 2 + 7 * size, 0);
    ctx.lineTo(bodyW / 2 - 2 * size, -bodyH / 2);
    ctx.lineTo(-bodyW / 2, -bodyH / 2 + 3 * size);
    ctx.lineTo(-bodyW / 2 - 7 * size, 0);
    ctx.lineTo(-bodyW / 2, bodyH / 2 - 3 * size);
    ctx.lineTo(bodyW / 2 - 2 * size, bodyH / 2);
  } else if (variant === 'turret') {
    ctx.rect(-bodyW / 2, -bodyH / 2, bodyW, bodyH);
  } else {
    ctx.moveTo(bodyW / 2 + 6 * size, -bodyH / 2 + 6 * size);
    ctx.lineTo(bodyW / 2 + 10 * size, 0);
    ctx.lineTo(bodyW / 2 + 6 * size, bodyH / 2 - 6 * size);
    ctx.lineTo(-bodyW / 2 + 3 * size, bodyH / 2);
    ctx.lineTo(-bodyW / 2 - 6 * size, bodyH / 2 - 6 * size);
    ctx.lineTo(-bodyW / 2 - 6 * size, -bodyH / 2 + 6 * size);
    ctx.lineTo(-bodyW / 2 + 3 * size, -bodyH / 2);
  }
  ctx.closePath();
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2 * size;
  ctx.stroke();

  drawPixelHighlight(ctx, [
    { x: -10 * size, y: -8 * size, w: 14 * size, h: 3 * size },
    { x: 3 * size, y: -3 * size, w: 9 * size, h: 2 * size },
    { x: -13 * size, y: 5 * size, w: 18 * size, h: 3 * size },
  ], highlight);

  if (variant === 'missile') {
    ctx.fillStyle = hullDark;
    ctx.fillRect(-3 * size, -17 * size, 20 * size, 5 * size);
    ctx.fillRect(-3 * size, 12 * size, 20 * size, 5 * size);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(14 * size, -16 * size, 5 * size, 3 * size);
    ctx.fillRect(14 * size, 13 * size, 5 * size, 3 * size);
  }

  ctx.strokeStyle = hullDark;
  ctx.lineWidth = (variant === 'elite' ? 9 : 7) * size;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(4 * size, 0);
  ctx.lineTo((variant === 'elite' ? 42 : 34) * size, 0);
  ctx.stroke();

  ctx.strokeStyle = gun;
  ctx.lineWidth = (variant === 'elite' ? 5 : 4) * size;
  ctx.beginPath();
  ctx.moveTo(7 * size, 0);
  ctx.lineTo((variant === 'elite' ? 44 : 36) * size, 0);
  ctx.stroke();

  ctx.fillStyle = hullDark;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2 * size;
  ctx.beginPath();
  ctx.arc(0, 0, (variant === 'elite' ? 12 : 10) * size, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = highlight;
  ctx.fillRect(-4 * size, -7 * size, 10 * size, 3 * size);
  ctx.fillRect(3 * size, 3 * size, 6 * size, 3 * size);

  ctx.restore();
}

function drawPlayerTank(ctx, p) {
  const bodyAngle = p.turretAngle;
  const recoil = p.recoilTimer > 0 ? (p.recoilTimer / 0.18) * 5 : 0;
  const drawX = p.x - Math.cos(bodyAngle) * recoil;
  const drawY = p.y - Math.sin(bodyAngle) * recoil;

  ctx.save();
  ctx.translate(drawX, drawY + 3);
  ctx.scale(1.15, 0.42);
  ctx.fillStyle = 'rgba(0,0,0,0.36)';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (p.shield > 0) {
    ctx.save();
    const shieldSpriteKey = getPlayerTankSpriteKey();
    if (!drawTankShieldAura(ctx, shieldSpriteKey, drawX, drawY, bodyAngle, shieldSpriteKey === 'playerHeavy' ? 1.22 : shieldSpriteKey === 'playerLight' ? 1.04 : 1.12)) {
      ctx.translate(drawX, drawY);
      ctx.rotate(bodyAngle);
      ctx.strokeStyle = 'rgba(88, 205, 255, 0.38)';
      ctx.shadowColor = 'rgba(88, 205, 255, 0.72)';
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(20, -16);
      ctx.lineTo(31, 0);
      ctx.lineTo(20, 16);
      ctx.lineTo(-19, 17);
      ctx.lineTo(-30, 7);
      ctx.lineTo(-30, -7);
      ctx.lineTo(-19, -17);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  const playerSpriteKey = getPlayerTankSpriteKey();
  if (drawTankSprite(ctx, playerSpriteKey, drawX, drawY, bodyAngle, playerSpriteKey === 'playerHeavy' ? 1.12 : playerSpriteKey === 'playerLight' ? 0.96 : 1.04)) {
    drawPlayerUpgradeOverlays(ctx, drawX, drawY, bodyAngle, p, 1);
    if (p.hitTimer > 0) {
      ctx.save();
      const flash = clamp(p.hitTimer / 0.18, 0, 1);
      ctx.globalAlpha = flash * 0.32;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(drawX, drawY, p.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (p.muzzleTimer > 0) {
      const power = clamp(p.muzzleTimer / 0.18, 0.35, 1);
      drawMuzzleFlash(ctx, drawX + Math.cos(bodyAngle) * 36, drawY + Math.sin(bodyAngle) * 36, bodyAngle, power);
    }
    const hpFrac = p.hp / p.maxHp;
    const barW = 42;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(p.x - barW/2, p.y - p.radius - 19, barW, 5);
    ctx.fillStyle = hpFrac > 0.5 ? '#3fb950' : hpFrac > 0.25 ? '#d29922' : '#f85149';
    ctx.fillRect(p.x - barW/2, p.y - p.radius - 19, barW * hpFrac, 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - barW/2, p.y - p.radius - 19, barW, 5);
    return;
  }

  drawTopDownTank(ctx, p.x, p.y, bodyAngle, {
    size: 0.9,
    hull: '#35c7ff',
    hullDark: '#0b3760',
    edge: '#f0fbff',
    highlight: 'rgba(255,255,255,0.46)',
    tread: '#101820',
    gun: '#e9fbff',
    variant: 'standard',
  });

  const topHpFrac = p.hp / p.maxHp;
  const topBarW = 42;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(p.x - topBarW/2, p.y - p.radius - 19, topBarW, 5);
  ctx.fillStyle = topHpFrac > 0.5 ? '#3fb950' : topHpFrac > 0.25 ? '#d29922' : '#f85149';
  ctx.fillRect(p.x - topBarW/2, p.y - p.radius - 19, topBarW * topHpFrac, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x - topBarW/2, p.y - p.radius - 19, topBarW, 5);
  return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(bodyAngle);

  ctx.fillStyle = '#101820';
  ctx.strokeStyle = '#2e4359';
  ctx.lineWidth = 2;
  ctx.fillRect(-18, -16, 34, 7);
  ctx.fillRect(-18, 9, 34, 7);
  ctx.strokeRect(-18, -16, 34, 7);
  ctx.strokeRect(-18, 9, 34, 7);

  ctx.fillStyle = '#26394a';
  for (let i = -15; i <= 12; i += 6) {
    ctx.fillRect(i, -15, 3, 5);
    ctx.fillRect(i, 10, 3, 5);
  }
  drawPixelHighlight(ctx, [
    { x: -17, y: -17, w: 4, h: 3 },
    { x: -5, y: -17, w: 4, h: 3 },
    { x: 7, y: -17, w: 4, h: 3 },
    { x: -17, y: 14, w: 4, h: 3 },
    { x: -5, y: 14, w: 4, h: 3 },
    { x: 7, y: 14, w: 4, h: 3 },
  ], '#9fd6ff');

  const hull = [
    { x: -18, y: -10 },
    { x: 13, y: -12 },
    { x: 22, y: -5 },
    { x: 22, y: 5 },
    { x: 13, y: 12 },
    { x: -18, y: 10 },
    { x: -24, y: 4 },
    { x: -24, y: -4 },
  ];
  ctx.beginPath();
  ctx.moveTo(hull[0].x, hull[0].y);
  for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i].x, hull[i].y);
  ctx.closePath();
  ctx.fillStyle = '#35c7ff';
  ctx.fill();
  ctx.strokeStyle = '#f0fbff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.36)';
  ctx.fillRect(-10, -7, 17, 3);
  ctx.fillRect(3, -3, 10, 2);
  ctx.fillStyle = 'rgba(6,18,32,0.45)';
  ctx.fillRect(-16, 5, 26, 3);
  ctx.fillRect(-19, -2, 9, 3);

  ctx.restore();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.turretAngle);

  ctx.strokeStyle = '#0d253f';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(35, 0);
  ctx.stroke();

  ctx.strokeStyle = '#e9fbff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(37, 0);
  ctx.stroke();

  ctx.fillStyle = '#1b84c6';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(4, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8deaff';
  ctx.fillRect(-5, 3, 8, 3);
  ctx.restore();

  const hpFrac = p.hp / p.maxHp;
  const barW = 38;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(p.x - barW/2, p.y - p.radius - 15, barW, 5);
  ctx.fillStyle = hpFrac > 0.5 ? '#3fb950' : hpFrac > 0.25 ? '#d29922' : '#f85149';
  ctx.fillRect(p.x - barW/2, p.y - p.radius - 15, barW * hpFrac, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(p.x - barW/2, p.y - p.radius - 15, barW, 5);
}

function drawObstacleBlock(ctx, obs) {
  if (!obs.alive) return;
  if (obs.type === 'terrain') return;
  const x = obs.x - obs.w / 2;
  const y = obs.y - obs.h / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(x + 5, y + 7, obs.w, obs.h);

  if (obs.type === 'crate') {
    if (drawAssetImage(ctx, BATTLE_ASSETS.obstacles.crate, obs.x, obs.y, obs.w + 8, obs.h + 8)) {
      const hpFrac = clamp(obs.hp / obs.maxHp, 0, 1);
      if (hpFrac < 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, y - 6, obs.w, 4);
        ctx.fillStyle = hpFrac > 0.45 ? '#d29922' : '#f85149';
        ctx.fillRect(x, y - 6, obs.w * hpFrac, 4);
      }
      ctx.restore();
      return;
    }
    const hpFrac = clamp(obs.hp / obs.maxHp, 0, 1);
    const grad = ctx.createLinearGradient(x, y, x + obs.w, y + obs.h);
    grad.addColorStop(0, '#9a6a32');
    grad.addColorStop(0.5, '#65401f');
    grad.addColorStop(1, '#2c1c12');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, obs.w, obs.h);
    ctx.strokeStyle = hpFrac > 0.45 ? '#d7a85f' : '#ff6b4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, obs.w, obs.h);
    ctx.strokeStyle = 'rgba(255,232,170,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5);
    ctx.lineTo(x + obs.w - 5, y + obs.h - 5);
    ctx.moveTo(x + obs.w - 5, y + 5);
    ctx.lineTo(x + 5, y + obs.h - 5);
    ctx.stroke();
    if (hpFrac < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y - 6, obs.w, 4);
      ctx.fillStyle = hpFrac > 0.45 ? '#d29922' : '#f85149';
      ctx.fillRect(x, y - 6, obs.w * hpFrac, 4);
    }
    ctx.restore();
    return;
  }

  if (drawAssetImage(ctx, BATTLE_ASSETS.obstacles.wall, obs.x, obs.y, obs.w, obs.h)) {
    ctx.restore();
    return;
  }

  const grad = ctx.createLinearGradient(x, y, x + obs.w, y + obs.h);
  grad.addColorStop(0, '#67727e');
  grad.addColorStop(0.48, '#333d49');
  grad.addColorStop(1, '#151c25');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, obs.w, obs.h);

  ctx.strokeStyle = '#aeb8c4';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, obs.w, obs.h);

  ctx.strokeStyle = 'rgba(255,204,64,0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 5);
  ctx.lineTo(x + Math.min(obs.w - 5, 42), y + 5);
  ctx.moveTo(x + obs.w - 5, y + obs.h - 5);
  ctx.lineTo(x + Math.max(5, obs.w - 42), y + obs.h - 5);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  for (let sx = x + 12; sx < x + obs.w; sx += 18) {
    ctx.beginPath();
    ctx.moveTo(sx, y + 2);
    ctx.lineTo(sx - 14, y + obs.h - 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemyUnit(ctx, e, player) {
  const angle = angleBetween(e, player);
  const hpFrac = e.hp / e.maxHp;
  const slowed = e.slowMult < 1;
  const recoil = e.recoilTimer > 0 ? (e.recoilTimer / 0.2) * (e.type === 'elite' ? 6 : 4) : 0;
  const drawX = e.x - Math.cos(angle) * recoil;
  const drawY = e.y - Math.sin(angle) * recoil;
  const spriteKey = {
    chaser: 'chaser',
    turret: 'turret',
    missile: 'missile',
    elite: 'elite',
  }[e.type] || 'grey';

  ctx.save();
  ctx.translate(drawX, drawY + 3);
  ctx.scale(1.1, 0.42);
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.arc(0, 0, e.radius + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (drawTankSprite(ctx, spriteKey, drawX, drawY, angle, e.type === 'elite' ? 1.15 : 1)) {
    if (e.hitTimer > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(e.hitTimer / 0.22, 0, 1) * 0.52;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(drawX, drawY, e.radius + 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (slowed) {
      ctx.save();
      ctx.strokeStyle = 'rgba(127,228,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(drawX, drawY, e.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (e.muzzleTimer > 0) {
      const muzzleLen = e.type === 'elite' ? 42 : 34;
      const flash = e.muzzleTimer / 0.16;
      drawMuzzleFlash(ctx, drawX + Math.cos(angle) * muzzleLen, drawY + Math.sin(angle) * muzzleLen, angle, flash, e.type === 'elite' ? '#ff5a4f' : '#ffb35a');
    }

    if (hpFrac < 1) {
      const barW = Math.max(28, e.radius * 2.7);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(e.x - barW / 2, e.y - e.radius - 13, barW, 4);
      ctx.fillStyle = hpFrac > 0.5 ? '#3fb950' : hpFrac > 0.25 ? '#d29922' : '#f85149';
      ctx.fillRect(e.x - barW / 2, e.y - e.radius - 13, barW * hpFrac, 4);
    }
    return;
  }

  const enemyStyle = {
    chaser: {
      size: 0.73,
      hull: '#ff5a4f',
      hullDark: '#551512',
      edge: '#ffc8c1',
      highlight: 'rgba(255,255,255,0.28)',
      tread: '#181010',
      gun: '#ffb1a8',
      variant: 'chaser',
    },
    turret: {
      size: 0.78,
      hull: '#a969ff',
      hullDark: '#321750',
      edge: '#e6cdff',
      highlight: 'rgba(255,255,255,0.24)',
      tread: '#1b1028',
      gun: '#d8b2ff',
      variant: 'turret',
    },
    missile: {
      size: 0.78,
      hull: '#8e9b55',
      hullDark: '#303719',
      edge: '#e7ef9d',
      highlight: 'rgba(255,255,255,0.23)',
      tread: '#14180e',
      gun: '#f4e58a',
      variant: 'missile',
    },
    elite: {
      size: 1.0,
      hull: '#d73434',
      hullDark: '#2b0b0b',
      edge: '#ffb3b3',
      highlight: 'rgba(255,255,255,0.24)',
      tread: '#150909',
      gun: '#ff6868',
      variant: 'elite',
    },
  }[e.type] || {
    size: 0.76,
    hull: e.color,
    hullDark: '#231313',
    edge: '#ffffff',
    highlight: 'rgba(255,255,255,0.2)',
    tread: '#111111',
    gun: '#ffffff',
    variant: 'standard',
  };

  if (slowed) {
    enemyStyle.hull = '#7fe4ff';
    enemyStyle.edge = '#dff9ff';
  }

  drawTopDownTank(ctx, e.x, e.y, angle, enemyStyle);

  if (e.muzzleTimer > 0) {
    const muzzleLen = e.type === 'elite' ? 44 : 36;
    const flash = e.muzzleTimer / 0.16;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#fff5a8';
    ctx.shadowColor = '#ff7b2e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(e.x + Math.cos(angle) * muzzleLen, e.y + Math.sin(angle) * muzzleLen, e.type === 'elite' ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (hpFrac < 1) {
    const barW = Math.max(28, e.radius * 2.7);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 13, barW, 4);
    ctx.fillStyle = hpFrac > 0.5 ? '#3fb950' : hpFrac > 0.25 ? '#d29922' : '#f85149';
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 13, barW * hpFrac, 4);
  }
  return;

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(angle);

  const palette = {
    chaser: { hull: '#ff5a4f', dark: '#571714', edge: '#ffc3bd', gun: '#ffb1a8' },
    turret: { hull: '#a969ff', dark: '#321750', edge: '#e1c7ff', gun: '#d8b2ff' },
    missile: { hull: '#ff9f43', dark: '#5a300a', edge: '#ffe0ad', gun: '#ffd08a' },
    elite: { hull: '#d73434', dark: '#2b0b0b', edge: '#ffb3b3', gun: '#ff6868' },
  }[e.type] || { hull: e.color, dark: '#231313', edge: '#fff', gun: '#fff' };

  const hullColor = slowed ? '#7fe4ff' : palette.hull;
  const scale = e.type === 'elite' ? 1.25 : 1;

  if (e.type === 'turret') {
    ctx.rotate(-angle);
    ctx.fillStyle = palette.dark;
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 2;
    ctx.fillRect(-16, -16, 32, 32);
    ctx.strokeRect(-16, -16, 32, 32);
    ctx.fillStyle = hullColor;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(angle);
  } else {
    ctx.fillStyle = palette.dark;
    ctx.fillRect(-17 * scale, -13 * scale, 28 * scale, 6 * scale);
    ctx.fillRect(-17 * scale, 7 * scale, 28 * scale, 6 * scale);
    drawPixelHighlight(ctx, [
      { x: -15 * scale, y: -14 * scale, w: 4 * scale, h: 3 * scale },
      { x: -5 * scale, y: -14 * scale, w: 4 * scale, h: 3 * scale },
      { x: 5 * scale, y: -14 * scale, w: 4 * scale, h: 3 * scale },
      { x: -15 * scale, y: 11 * scale, w: 4 * scale, h: 3 * scale },
      { x: -5 * scale, y: 11 * scale, w: 4 * scale, h: 3 * scale },
      { x: 5 * scale, y: 11 * scale, w: 4 * scale, h: 3 * scale },
    ], palette.edge);

    ctx.fillStyle = hullColor;
    ctx.strokeStyle = palette.edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (e.type === 'chaser') {
      ctx.moveTo(20, 0);
      ctx.lineTo(-14, -13);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-14, 13);
    } else {
      ctx.moveTo(20 * scale, -8 * scale);
      ctx.lineTo(24 * scale, 0);
      ctx.lineTo(20 * scale, 8 * scale);
      ctx.lineTo(-19 * scale, 11 * scale);
      ctx.lineTo(-23 * scale, 0);
      ctx.lineTo(-19 * scale, -11 * scale);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawPixelHighlight(ctx, [
      { x: -10 * scale, y: -6 * scale, w: 14 * scale, h: 3 * scale },
      { x: 4 * scale, y: -2 * scale, w: 9 * scale, h: 2 * scale },
      { x: -15 * scale, y: 5 * scale, w: 18 * scale, h: 3 * scale },
    ], 'rgba(255,255,255,0.18)');

    if (e.type === 'missile') {
      ctx.fillStyle = '#2a1a08';
      ctx.fillRect(-2, -13, 19, 5);
      ctx.fillRect(-2, 8, 19, 5);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(13, -12, 5, 3);
      ctx.fillRect(13, 9, 5, 3);
    }
  }

  ctx.strokeStyle = palette.dark;
  ctx.lineWidth = e.type === 'elite' ? 9 : 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(e.type === 'elite' ? 38 : 28, 0);
  ctx.stroke();

  ctx.strokeStyle = palette.gun;
  ctx.lineWidth = e.type === 'elite' ? 5 : 3;
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(e.type === 'elite' ? 40 : 30, 0);
  ctx.stroke();

  if (e.muzzleTimer > 0) {
    const muzzleX = e.type === 'elite' ? 42 : 32;
    const flash = e.muzzleTimer / 0.16;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#fff5a8';
    ctx.shadowColor = '#ff7b2e';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(muzzleX, 0, e.type === 'elite' ? 8 : 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = palette.dark;
  ctx.strokeStyle = palette.edge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, e.type === 'elite' ? 10 : 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  if (hpFrac < 1) {
    const barW = Math.max(24, e.radius * 2.4);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 9, barW, 4);
    ctx.fillStyle = hpFrac > 0.5 ? '#3fb950' : hpFrac > 0.25 ? '#d29922' : '#f85149';
    ctx.fillRect(e.x - barW / 2, e.y - e.radius - 9, barW * hpFrac, 4);
  }
}

function drawBullet(ctx, b) {
  if (b.kind === 'rocket') {
    const progress = clamp(b.elapsed / b.flightTime, 0, 1);
    const warningAlpha = 0.22 + Math.sin(progress * Math.PI * 6) * 0.08;
    ctx.save();
    ctx.globalAlpha = warningAlpha;
    ctx.strokeStyle = '#ff4d3d';
    ctx.fillStyle = 'rgba(255,77,61,0.08)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(b.targetX, b.targetY, b.explosionRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const drawX = b.x;
    const drawY = b.y - (b.z || 0);
    const shadowScale = 1 - Math.min(0.55, (b.z || 0) / 110);
    ctx.save();
    ctx.globalAlpha = 0.32 * shadowScale;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 3, 12 * shadowScale, 4 * shadowScale, b.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const rocketAsset = BATTLE_ASSETS.bullets.rocket;
    ctx.save();
    ctx.translate(drawX, drawY);
    ctx.rotate(b.angle || 0);
    ctx.shadowColor = '#ff7b2e';
    ctx.shadowBlur = 12;
    if (rocketAsset?.ready) {
      ctx.drawImage(rocketAsset.img, -rocketAsset.w / 2, -rocketAsset.h / 2, rocketAsset.w, rocketAsset.h);
    } else {
      ctx.fillStyle = '#343a46';
      ctx.strokeStyle = '#ffcf5a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(3, -5);
      ctx.lineTo(-14, -4);
      ctx.lineTo(-17, 0);
      ctx.lineTo(-14, 4);
      ctx.lineTo(3, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff7b2e';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-28, -4);
      ctx.lineTo(-22, 0);
      ctx.lineTo(-28, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  const angle = b.angle || Math.atan2(b.vy, b.vx);
  const isEnemy = b.owner === 'enemy';
  const isPierce = b.pierce;
  const isExplosive = b.explosion;
  const isEmp = b.slowEffect > 0;
  const assetKey = isEmp ? 'emp' : isPierce ? 'pierce' : isExplosive ? 'burst' : isEnemy ? 'enemy' : 'basic';
  const bulletAsset = BATTLE_ASSETS.bullets[assetKey];

  if (bulletAsset && bulletAsset.ready) {
    const glow = isEmp ? '#6bcbff' : isExplosive || isEnemy ? '#ff7b2e' : isPierce ? '#8fe8ff' : '#ffd166';
    const length = bulletAsset.w;
    const width = bulletAsset.h;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.52;
    const trail = ctx.createLinearGradient(-length * 1.2, 0, -length * 0.1, 0);
    trail.addColorStop(0, 'rgba(255,255,255,0)');
    trail.addColorStop(1, glow);
    ctx.fillStyle = trail;
    ctx.beginPath();
    ctx.moveTo(-length * 1.2, 0);
    ctx.lineTo(-length * 0.18, -width * 0.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-length * 0.18, width * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowColor = glow;
    ctx.shadowBlur = isEmp || isExplosive ? 12 : 7;
    ctx.drawImage(bulletAsset.img, -length / 2, -width / 2, length, width);
    ctx.restore();
    return;
  }

  let length = isEnemy ? 18 : 20;
  let width = isEnemy ? 7 : 8;
  let core = b.color || (isEnemy ? '#ff8844' : '#ffd700');
  let shell = isEnemy ? '#5b1410' : '#5c4208';
  let tip = '#fff3b0';
  let glow = core;

  if (isPierce) {
    length = 28;
    width = 6;
    shell = '#6a4a00';
    tip = '#ffffff';
    glow = '#ffe66d';
  } else if (isExplosive) {
    length = 19;
    width = 12;
    shell = '#6b250c';
    tip = '#ffd0a0';
    glow = '#ff7b2e';
  } else if (isEmp) {
    length = 22;
    width = 9;
    shell = '#0a3c5a';
    tip = '#dff9ff';
    glow = '#6bcbff';
  } else if (isEnemy) {
    shell = '#4e120d';
    tip = '#fff1c2';
    glow = b.color || '#ff8844';
  }

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);

  ctx.globalAlpha = 0.48;
  const trail = ctx.createLinearGradient(-length, 0, 2, 0);
  trail.addColorStop(0, 'rgba(255,255,255,0)');
  trail.addColorStop(1, glow);
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(-length * 1.25, 0);
  ctx.lineTo(-4, -width * 0.8);
  ctx.lineTo(3, 0);
  ctx.lineTo(-4, width * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.shadowColor = glow;
  ctx.shadowBlur = isExplosive || isEmp ? 12 : 8;

  if (isExplosive) {
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(0, 0, length * 0.42, width * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(3, 0, length * 0.25, width * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (isEmp) {
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.moveTo(length * 0.55, 0);
    ctx.lineTo(0, -width * 0.7);
    ctx.lineTo(-length * 0.55, 0);
    ctx.lineTo(0, width * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = tip;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, length * 0.55, width * 0.9, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.moveTo(length * 0.58, 0);
    ctx.lineTo(length * 0.18, -width * 0.52);
    ctx.lineTo(-length * 0.52, -width * 0.45);
    ctx.lineTo(-length * 0.64, 0);
    ctx.lineTo(-length * 0.52, width * 0.45);
    ctx.lineTo(length * 0.18, width * 0.52);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = core;
    ctx.fillRect(-length * 0.35, -width * 0.28, length * 0.58, width * 0.56);
    ctx.fillStyle = tip;
    ctx.beginPath();
    ctx.moveTo(length * 0.68, 0);
    ctx.lineTo(length * 0.18, -width * 0.5);
    ctx.lineTo(length * 0.18, width * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  if (isEmp) {
    ctx.strokeStyle = 'rgba(210,250,255,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-length * 0.2, -width);
    ctx.lineTo(length * 0.05, -width * 0.25);
    ctx.lineTo(-length * 0.05, width * 0.2);
    ctx.lineTo(length * 0.24, width);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEffect(ctx, fx) {
  const alpha = clamp(fx.timer / fx.maxTimer, 0, 1);
  if (fx.kind === 'spark') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = fx.color || '#ffd166';
    ctx.lineWidth = Math.max(1, fx.size || 2);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(fx.x, fx.y);
    ctx.lineTo(fx.x - fx.vx * 0.035, fx.y - fx.vy * 0.035);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const size = fx.size * (1.18 - alpha * 0.18);
  const asset = BATTLE_ASSETS.effects.explosion;
  if (drawAssetImage(ctx, asset, fx.x, fx.y, size, size, 0, alpha)) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffb000';
  ctx.shadowColor = '#ff5f1f';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, size / 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---- Render ----
function renderGame() {
  if (!game) return;

  const ctx = battleCtx;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;

  // Scale to canvas size
  const scaleX = W / MAP_W;
  const scaleY = H / MAP_H;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (W - MAP_W * scale) / 2;
  const offsetY = (H - MAP_H * scale) / 2;
  const shake = game.screenShake || 0;
  const shakeX = shake > 0 ? rand(-shake, shake) : 0;
  const shakeY = shake > 0 ? rand(-shake, shake) : 0;

  ctx.save();
  ctx.translate(offsetX + shakeX, offsetY + shakeY);
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.rect(0, 0, MAP_W, MAP_H);
  ctx.clip();

  // Background terrain
  drawTiledGround(ctx);

  ctx.fillStyle = 'rgba(7,12,18,0.18)';
  ctx.fillRect(0, 0, MAP_W, MAP_H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x < MAP_W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke();
  }
  for (let y = 0; y < MAP_H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MAP_W, y); ctx.stroke();
  }

  // Map border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, MAP_W, MAP_H);

  // Terrain decorations
  for (const deco of TERRAIN_DECORATIONS) {
    drawTerrainDecoration(ctx, deco);
  }

  // Obstacles
  for (const obs of OBSTACLES) {
    drawObstacleBlock(ctx, obs);
  }

  // Drops
  for (const drop of game.drops) {
    if (!drop.alive) continue;
    drop.bobTimer += 0.05;
    const by = Math.sin(drop.bobTimer) * 3;
    const alpha = drop.life < 3 ? (drop.life / 3) : 1;

    ctx.globalAlpha = alpha;
    if (drop.type === 'ammo') {
      ctx.fillStyle = AMMO_DEFS[drop.ammoType]?.color || '#58a6ff';
      ctx.beginPath();
      ctx.arc(drop.x, drop.y + by, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(AMMO_DEFS[drop.ammoType]?.dropLetter || '?', drop.x, drop.y + by);
    } else {
      const asset = drop.equipDrop?.bonus ? BATTLE_ASSETS.pickups.equipBoxBonus : BATTLE_ASSETS.pickups.equipBox;
      if (!drawAssetImage(ctx, asset, drop.x, drop.y + by, 22, 22, 0, alpha)) {
        const gold = drop.equipDrop?.bonus ? '#ffd1a8' : '#ffd700';
        ctx.fillStyle = gold;
        ctx.fillRect(drop.x - 7, drop.y + by - 7, 14, 14);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(drop.x - 7, drop.y + by - 7, 14, 14);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Enemy bullets
  for (const b of game.enemyBullets) {
    if (!b.alive) continue;
    drawBullet(ctx, b);
  }

  // Player bullets
  for (const b of game.bullets) {
    if (!b.alive) continue;
    drawBullet(ctx, b);
  }

  // Hit effects
  for (const fx of game.effects) {
    if (!fx.alive) continue;
    drawEffect(ctx, fx);
  }

  // Enemies
  for (const e of game.enemies) {
    if (!e.alive) continue;
    const visibility = getEntityFoliageVisibility(e);
    if (visibility <= 0.02) continue;
    ctx.save();
    ctx.globalAlpha = visibility;
    drawEnemyUnit(ctx, e, game.player);
    ctx.restore();
  }

  // Player
  const p = game.player;
  if (p.alive) {
    const visibility = getEntityFoliageVisibility(p);
    if (visibility > 0.02) {
      ctx.save();
      ctx.globalAlpha = visibility;
    drawPlayerTank(ctx, p);
      ctx.restore();
    }
  }

  ctx.restore();

  // ---- Canvas-independent HUD drawn on canvas ----
  // Time bar at top
  const timeFrac = game.time / game.maxTime;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = timeFrac > 0.7 ? '#3fb950' : timeFrac > 0.4 ? '#d29922' : '#f85149';
  ctx.fillRect(0, 0, W * (1 - timeFrac), 4);

  // Ammo display
  if (p.currentAmmo) {
    const ammoFrac = p.ammoTimer / (p.currentAmmo.duration + (p.ammoDurationBonus || 0) || 1);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    const bx = 10, by = 14, bw = 120, bh = 14;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = p.currentAmmo.color;
    ctx.fillRect(bx, by, bw * ammoFrac, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.currentAmmo.name, bx + bw/2, by + bh/2);
  }
}

// ---- Battle messages ----
let battleMessages = [];
function addBattleMessage(text, color) {
  battleMessages.push({ text, color, timer: 2 });
}

// ---- Input ----
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});
