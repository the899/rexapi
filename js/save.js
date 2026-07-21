// ============================================================
// PERSISTENCE — localStorage save/load for garage, tech, progress
// ============================================================

const SAVE_KEY = 'tank_survival_save';

function defaultSave() {
  const equipment = {};
  // Give player all common items by default
  for (const [id, item] of Object.entries(EQUIP_ITEMS)) {
    equipment[id] = { owned: true, count: item.rarity === 'common' ? 1 : 0, bonusCount: 0 };
  }
  // Start with basic hull and cannon equipped
  const equipSlots = {
    hull: 'light_hull',
    cannon: 'rapid_cannon',
    turretSys: null,
    tracks: null,
    armor: null,
    chip: null,
  };

  const techLevels = {};
  for (const tree of TECH_TREES) {
    for (const node of tree.nodes) {
      techLevels[node.id] = 0;
    }
  }

  return {
    gold: 0,
    techPoints: 0,
    completedStages: [],
    equipSlots,
    inventory: equipment,
    techLevels,
    totalKills: 0,
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Ensure all fields exist for forward compat
      const def = defaultSave();
      for (const key of Object.keys(def)) {
        if (data[key] === undefined) data[key] = def[key];
      }
      // Ensure all inventory items exist
      for (const [id, val] of Object.entries(def.inventory)) {
        if (data.inventory[id] === undefined) data.inventory[id] = val;
        if (data.inventory[id].bonusCount === undefined) data.inventory[id].bonusCount = 0;
      }
      // Ensure all tech nodes exist
      for (const [id, lvl] of Object.entries(def.techLevels)) {
        if (data.techLevels[id] === undefined) data.techLevels[id] = lvl;
      }
      return data;
    }
  } catch (e) {
    console.warn('Save load failed, using defaults', e);
  }
  return defaultSave();
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
}

function applyStatBlock(stats, statBlock, mult = 1) {
  if (!statBlock) return;
  for (const [key, val] of Object.entries(statBlock)) {
    if (stats[key] === undefined) continue;
    if (key === 'fireRate') {
      stats[key] -= val * mult;
    } else {
      stats[key] += val * mult;
    }
  }
}

function hasBonusEquipCopy(itemId, save = gameState) {
  const inv = save?.inventory?.[itemId];
  return !!inv && (inv.bonusCount || 0) > 0;
}

function getItemBonusStats(item) {
  return item?.bonusStats || {};
}

function getEquippedStats() {
  const stats = defaultTankStats();
  const save = gameState;

  // Apply equipment
  for (const [slotId, itemId] of Object.entries(save.equipSlots)) {
    if (!itemId) continue;
    const item = EQUIP_ITEMS[itemId];
    if (!item) continue;
    const mult = RARITY_MULT[item.rarity] || 1;
    applyStatBlock(stats, item.stats, mult);
    if (hasBonusEquipCopy(itemId, save)) {
      applyStatBlock(stats, getItemBonusStats(item), 1);
    }
  }

  // Apply tech tree
  for (const tree of TECH_TREES) {
    for (const node of tree.nodes) {
      const lvl = save.techLevels[node.id] || 0;
      if (lvl > 0) {
        // Tech apply functions mutate stats directly
        // We need to handle it differently since apply is a function string
        // Let's inline the logic here
        applyTechNode(node.id, lvl, stats);
      }
    }
  }

  // Clamp values
  stats.maxHp = Math.max(50, stats.maxHp);
  stats.speed = Math.max(40, stats.speed);
  stats.damage = Math.max(5, stats.damage);
  stats.fireRate = Math.max(0.15, stats.fireRate - (stats.fireRateBonus || 0));
  stats.fireRate = Math.min(0.6, stats.fireRate);
  stats.pickupRange = Math.max(1.0, stats.pickupRange || 1.0);
  stats.bulletSpeedMult = Math.max(0.6, stats.bulletSpeedMult || 1.0);
  stats.blastDamageMult = Math.max(0.5, stats.blastDamageMult || 1.0);
  stats.blastReduction = clamp(stats.blastReduction || 0, 0, 0.75);
  stats.lowHpSpeed = Math.max(0, stats.lowHpSpeed || 0);
  stats.equipDropBonus = Math.max(0, stats.equipDropBonus || 0);
  stats.bonusEquipChance = Math.max(0, stats.bonusEquipChance || 0);

  return stats;
}

function applyTechNode(nodeId, level, stats) {
  // Inlined tech effects
  switch (nodeId) {
    case 'surv_hp': stats.maxHp += 20 * level; break;
    case 'surv_shield': stats.shieldRegen += 1 * level; break;
    case 'surv_collision': stats.collisionReduction += 2 * level; break;
    case 'surv_blast': stats.blastReduction += 0.08 * level; break;
    case 'mob_speed': stats.speed += 8 * level; break;
    case 'mob_pickup': stats.pickupRange = 1.0 + 0.2 * level; break;
    case 'mob_slowres': stats.slowResist += 0.2 * level; break;
    case 'mob_escape': stats.lowHpSpeed += 0.1 * level; break;
    case 'fp_damage': stats.damage += 5 * level; break;
    case 'fp_firerate': stats.fireRateBonus += 0.05 * level; break;
    case 'fp_ammotime': stats.ammoDurationBonus += 3 * level; break;
    case 'fp_speed': stats.bulletSpeedMult += 0.1 * level; break;
    case 'tac_loot': stats.equipDropBonus += 0.1 * level; break;
    case 'tac_bonus': stats.bonusEquipChance += 0.08 * level; break;
    case 'tac_vision': stats.lockRange += 24 * level; break;
    case 'tac_ammo': stats.ammoDurationBonus += 2 * level; break;
  }
}
