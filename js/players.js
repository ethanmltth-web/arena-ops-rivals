import { RIVALS, FIRST_NAMES, LAST_NAMES, SIGNATURE_PLAYERS } from './data/rivals.js';
import { clamp, pick, randInt, uid } from './utils.js';

export function calcOvr(stats) {
  const w = RIVALS.ovrWeights;
  let sum = 0;
  let weight = 0;
  for (const [key, value] of Object.entries(w)) {
    sum += (stats[key] || 0) * value;
    weight += value;
  }
  return Math.round(sum / weight);
}

function randomName(used = new Set()) {
  let name;
  let tries = 0;
  do {
    name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    tries += 1;
  } while (used.has(name) && tries < 40);
  used.add(name);
  return name;
}

function rollStat(tier) {
  // tier: 1 low, 2 mid, 3 high prospect
  if (tier === 1) return randInt(48, 68);
  if (tier === 3) return randInt(72, 88);
  return randInt(58, 78);
}

export function createGeneratedPlayer(options = {}) {
  const tier = options.tier ?? randInt(1, 3);
  const used = options.usedNames || new Set();
  const role = options.role || pick(RIVALS.roles);
  const stats = {
    aim: rollStat(tier),
    movement: rollStat(tier),
    mechanics: rollStat(tier),
    gameSense: rollStat(tier),
    teamwork: rollStat(tier),
    morale: randInt(60, 90),
    energy: randInt(70, 100),
  };

  // Soft role bias
  if (role === 'Duelist' || role === 'Entry') {
    stats.aim = clamp(stats.aim + randInt(2, 8), 40, 95);
    stats.mechanics = clamp(stats.mechanics + randInt(1, 6), 40, 95);
  } else if (role === 'Support' || role === 'Controller') {
    stats.teamwork = clamp(stats.teamwork + randInt(3, 8), 40, 95);
    stats.gameSense = clamp(stats.gameSense + randInt(2, 7), 40, 95);
  } else if (role === 'Flex') {
    stats.mechanics = clamp(stats.mechanics + randInt(2, 6), 40, 95);
    stats.movement = clamp(stats.movement + randInt(1, 5), 40, 95);
  }

  const ovr = calcOvr(stats);
  const potential = clamp(ovr + randInt(4, 18), ovr, 99);
  const signingFee = Math.round(ovr * ovr * 18 + randInt(2000, 12000));
  const salary = Math.round(ovr * 55 + randInt(200, 900));

  return {
    id: uid('pl'),
    name: randomName(used),
    role,
    signature: false,
    bio: 'Generated prospect from the Rivals open circuit.',
    stats,
    potential,
    signingFee,
    salary,
    ovr,
    age: randInt(16, 24),
    weeksOnTeam: 0,
  };
}

export function createSignaturePlayer(template) {
  const stats = { ...template.base };
  return {
    id: template.id,
    name: template.name,
    role: template.role,
    signature: true,
    bio: template.bio,
    stats,
    potential: template.potential,
    signingFee: template.signingFee,
    salary: template.salary,
    ovr: calcOvr(stats),
    age: randInt(18, 26),
    weeksOnTeam: 0,
  };
}

export function buildFreeAgencyPool(count = 24) {
  const used = new Set(SIGNATURE_PLAYERS.map((p) => p.name));
  const pool = SIGNATURE_PLAYERS.map(createSignaturePlayer);
  while (pool.length < count) {
    pool.push(createGeneratedPlayer({ usedNames: used }));
  }
  return pool.sort((a, b) => b.ovr - a.ovr);
}

export function generateAiRoster(strength = 70) {
  const used = new Set();
  const roster = [];
  for (let i = 0; i < RIVALS.rosterSize; i++) {
    const tier = strength >= 78 ? 3 : strength >= 68 ? 2 : 1;
    const p = createGeneratedPlayer({ tier, usedNames: used, role: RIVALS.roles[i % RIVALS.roles.length] });
    // Nudge toward team strength
    for (const key of Object.keys(RIVALS.ovrWeights)) {
      const target = clamp(strength + randInt(-8, 8), 45, 92);
      p.stats[key] = Math.round((p.stats[key] + target) / 2);
    }
    p.ovr = calcOvr(p.stats);
    p.salary = Math.round(p.ovr * 50 + randInt(100, 600));
    roster.push(p);
  }
  return roster;
}

export function startingFive(roster) {
  return [...roster].sort((a, b) => b.ovr - a.ovr).slice(0, RIVALS.rosterSize);
}

export function teamAverage(roster, key) {
  const five = startingFive(roster);
  if (!five.length) return 0;
  return five.reduce((s, p) => s + (p.stats[key] || 0), 0) / five.length;
}

export function teamOvr(roster) {
  const five = startingFive(roster);
  if (!five.length) return 0;
  return Math.round(five.reduce((s, p) => s + p.ovr, 0) / five.length);
}

export function refreshPlayerOvr(player) {
  player.ovr = calcOvr(player.stats);
  return player;
}
