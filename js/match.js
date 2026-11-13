import { RIVALS } from './data/rivals.js';
import { startingFive, teamAverage, teamOvr } from './players.js';
import { clamp, pick, randInt } from './utils.js';

const TACTIC_MODS = {
  balanced: { aim: 0, movement: 0, mechanics: 0, gameSense: 0, teamwork: 0 },
  aggressive: { aim: 6, movement: 2, mechanics: 5, gameSense: -3, teamwork: -2 },
  defensive: { aim: -2, movement: -1, mechanics: 0, gameSense: 6, teamwork: 5 },
  pace: { aim: 1, movement: 7, mechanics: 2, gameSense: -2, teamwork: 0 },
};

function power(roster, tactic = 'balanced') {
  const mods = TACTIC_MODS[tactic] || TACTIC_MODS.balanced;
  const five = startingFive(roster);
  if (!five.length) return 40;

  const energy = teamAverage(roster, 'energy') / 100;
  const morale = teamAverage(roster, 'morale') / 100;

  let score = 0;
  for (const key of Object.keys(RIVALS.ovrWeights)) {
    const base = teamAverage(roster, key) + (mods[key] || 0);
    score += base * RIVALS.ovrWeights[key];
  }

  // Form modifiers
  score *= 0.72 + energy * 0.18 + morale * 0.1;
  return score;
}

function simulateMap(homePower, awayPower, mapName) {
  const homeRoll = homePower + randInt(-12, 12);
  const awayRoll = awayPower + randInt(-12, 12);
  const homeScore = clamp(Math.round(8 + (homeRoll - awayRoll) * 0.15 + randInt(0, 5)), 5, 13);
  let awayScore;
  if (homeScore >= 13) {
    awayScore = randInt(4, 11);
  } else {
    awayScore = 13;
  }

  // Ensure one side reaches 13 and leads
  if (homeRoll >= awayRoll) {
    return {
      map: mapName,
      home: 13,
      away: clamp(awayScore, 4, 11),
      winner: 'home',
      narrative: buildMapNarrative(mapName, true, homeRoll - awayRoll),
    };
  }
  return {
    map: mapName,
    home: clamp(homeScore, 4, 11),
    away: 13,
    winner: 'away',
    narrative: buildMapNarrative(mapName, false, awayRoll - homeRoll),
  };
}

function buildMapNarrative(map, homeWon, margin) {
  const events = [
    'early mid control decides the half',
    'a heroic 1v3 clutch flips momentum',
    'utility executions open the site cleanly',
    'eco rounds keep the deficit close',
    'movement tech wins multiple duels',
    'IGL timeouts reset the team composure',
  ];
  const edge = margin > 10 ? 'dominates' : margin > 4 ? 'edges' : 'barely takes';
  const side = homeWon ? 'Home' : 'Away';
  return `${side} ${edge} ${map} — ${pick(events)}.`;
}

/**
 * Best-of-3 series.
 * Returns log lines, map results, and series score.
 */
export function simulateSeries(homeTeam, awayTeam, tactic = 'balanced') {
  const homeP = power(homeTeam.roster, homeTeam.isPlayer ? tactic : 'balanced');
  const awayP = power(awayTeam.roster, 'balanced');
  const mapsPool = [...RIVALS.maps].sort(() => Math.random() - 0.5);

  const log = [];
  log.push(`SERIES: ${homeTeam.name} vs ${awayTeam.name}`);
  log.push(`Team OVR ${teamOvr(homeTeam.roster)} vs ${teamOvr(awayTeam.roster)} · Tactic: ${tactic}`);

  let homeMaps = 0;
  let awayMaps = 0;
  const results = [];

  for (let i = 0; i < 3 && homeMaps < 2 && awayMaps < 2; i++) {
    const mapName = mapsPool[i];
    const result = simulateMap(homeP, awayP, mapName);
    results.push(result);
    if (result.winner === 'home') homeMaps += 1;
    else awayMaps += 1;

    log.push(`MAP ${i + 1} — ${mapName}: ${result.home}–${result.away}`);
    log.push(result.narrative);
  }

  const homeWon = homeMaps > awayMaps;
  log.push(`FINAL: ${homeTeam.name} ${homeMaps}–${awayMaps} ${awayTeam.name}`);
  log.push(homeWon ? `${homeTeam.name} takes the series.` : `${awayTeam.name} takes the series.`);

  return { homeMaps, awayMaps, homeWon, results, log };
}

/** Drain energy / nudge morale after a played match for the player roster */
export function applyMatchFatigue(roster, won) {
  for (const p of startingFive(roster)) {
    p.stats.energy = clamp(p.stats.energy - randInt(8, 16), 15, 100);
    p.stats.morale = clamp(p.stats.morale + (won ? randInt(1, 5) : -randInt(1, 6)), 20, 100);
  }
}
