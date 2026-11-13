import { RIVALS } from './data/rivals.js';
import { createLeague, getPlayerFixture, getTeam, getWeekFixtures, applyMatchResult } from './league.js';
import { simulateSeries, applyMatchFatigue } from './match.js';
import { buildFreeAgencyPool, createGeneratedPlayer, startingFive, teamAverage, teamOvr, refreshPlayerOvr } from './players.js';
import { uid, clamp, randInt, deepClone } from './utils.js';

const SAVE_KEY = 'arena_ops_rivals_v1';

export function hasSave() {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function newCareer({ name, color }) {
  const teamId = uid('team');
  const used = new Set();
  const starterRoster = [];
  // Give the player a weak-mid starter five so free agency matters
  for (let i = 0; i < RIVALS.rosterSize; i++) {
    starterRoster.push(
      createGeneratedPlayer({
        tier: i < 2 ? 2 : 1,
        usedNames: used,
        role: RIVALS.roles[i],
      })
    );
  }
  starterRoster.forEach((p) => {
    p.weeksOnTeam = 0;
  });

  const team = {
    id: teamId,
    name: name.trim() || 'Neon Drift',
    color: color || '#00e5a8',
    roster: starterRoster,
  };

  const league = createLeague(team);
  // Keep player roster reference shared
  const playerSlot = league.teams.find((t) => t.isPlayer);
  playerSlot.roster = team.roster;

  const state = {
    version: 1,
    game: 'rivals',
    season: 1,
    team,
    league,
    freeAgents: buildFreeAgencyPool(28),
    budget: 250000,
    ledger: [
      { week: 1, label: 'Owner seed capital', amount: 250000 },
    ],
    trainingUsedThisWeek: 0,
    matchPlayedThisWeek: false,
    flags: {
      signedAnyone: false,
      trainedOnce: false,
    },
  };

  return state;
}

export function weeklyPayroll(state) {
  return state.team.roster.reduce((s, p) => s + (p.salary || 0), 0);
}

export function signPlayer(state, playerId) {
  if (state.team.roster.length >= RIVALS.maxRoster) {
    return { ok: false, message: `Roster full (max ${RIVALS.maxRoster}). Release someone first.` };
  }
  const idx = state.freeAgents.findIndex((p) => p.id === playerId);
  if (idx < 0) return { ok: false, message: 'Player no longer available.' };
  const player = state.freeAgents[idx];
  const cost = player.signingFee;
  if (state.budget < cost) return { ok: false, message: 'Not enough budget for the signing fee.' };

  state.budget -= cost;
  state.ledger.unshift({
    week: state.league.week,
    label: `Signed ${player.name}${player.signature ? ' ★' : ''}`,
    amount: -cost,
  });
  state.freeAgents.splice(idx, 1);
  player.weeksOnTeam = 0;
  state.team.roster.push(player);
  state.flags.signedAnyone = true;
  syncPlayerTeam(state);
  return { ok: true, message: `Signed ${player.name} for $${cost.toLocaleString()}.` };
}

export function releasePlayer(state, playerId) {
  if (state.team.roster.length <= RIVALS.rosterSize) {
    return { ok: false, message: 'You need at least 5 players. Sign a replacement first.' };
  }
  const idx = state.team.roster.findIndex((p) => p.id === playerId);
  if (idx < 0) return { ok: false, message: 'Player not on roster.' };
  const [player] = state.team.roster.splice(idx, 1);
  // Soft buyout
  const buyout = Math.round(player.salary * 2);
  state.budget = Math.max(0, state.budget - buyout);
  state.ledger.unshift({
    week: state.league.week,
    label: `Released ${player.name} (buyout)`,
    amount: -buyout,
  });
  // Return to agency slightly worse morale
  player.stats.morale = clamp(player.stats.morale - 8, 20, 100);
  refreshPlayerOvr(player);
  state.freeAgents.push(player);
  state.freeAgents.sort((a, b) => b.ovr - a.ovr);
  syncPlayerTeam(state);
  return { ok: true, message: `Released ${player.name}.` };
}

function syncPlayerTeam(state) {
  const slot = state.league.teams.find((t) => t.isPlayer);
  if (slot) {
    slot.roster = state.team.roster;
    slot.name = state.team.name;
    slot.color = state.team.color;
  }
}

export function playPlayerMatch(state, tactic) {
  if (state.matchPlayedThisWeek) {
    return { ok: false, message: 'You already played this week’s match.' };
  }
  const fixture = getPlayerFixture(state.league, state.team.id);
  if (!fixture || fixture.played) {
    return { ok: false, message: 'No match scheduled this week.' };
  }
  if (state.team.roster.length < RIVALS.rosterSize) {
    return { ok: false, message: 'Need 5 players to compete.' };
  }

  const home = getTeam(state.league, fixture.homeId);
  const away = getTeam(state.league, fixture.awayId);
  // Attach live player roster
  if (home.isPlayer) home.roster = state.team.roster;
  if (away.isPlayer) away.roster = state.team.roster;

  const series = simulateSeries(home, away, tactic);
  applyMatchResult(state.league, fixture, series.homeMaps, series.awayMaps);

  const playerIsHome = home.isPlayer;
  const won = playerIsHome ? series.homeWon : !series.homeWon;
  applyMatchFatigue(state.team.roster, won);

  const prize = won ? 45000 : 12000;
  state.budget += prize;
  state.ledger.unshift({
    week: state.league.week,
    label: won ? 'Match win prize' : 'Match appearance fee',
    amount: prize,
  });

  state.matchPlayedThisWeek = true;
  return { ok: true, series, won, prize, fixture };
}

/** Simulate all non-player fixtures for the week */
export function simCpuWeek(state) {
  const fixtures = getWeekFixtures(state.league);
  for (const f of fixtures) {
    if (f.played) continue;
    if (f.homeId === state.team.id || f.awayId === state.team.id) continue;
    const home = getTeam(state.league, f.homeId);
    const away = getTeam(state.league, f.awayId);
    const series = simulateSeries(home, away, 'balanced');
    applyMatchResult(state.league, f, series.homeMaps, series.awayMaps);
  }
}

export function advanceWeek(state) {
  const fixture = getPlayerFixture(state.league, state.team.id);
  if (fixture && !fixture.played && !state.matchPlayedThisWeek) {
    return { ok: false, message: 'Play your match before advancing the week.' };
  }

  // Finish any remaining CPU games
  simCpuWeek(state);

  // Payroll
  const payroll = weeklyPayroll(state);
  state.budget -= payroll;
  state.ledger.unshift({
    week: state.league.week,
    label: 'Weekly payroll',
    amount: -payroll,
  });

  // Passive recovery / morale drift
  for (const p of state.team.roster) {
    p.stats.energy = clamp(p.stats.energy + randInt(4, 10), 0, 100);
    p.weeksOnTeam = (p.weeksOnTeam || 0) + 1;
    if (p.stats.morale < 40) p.stats.morale = clamp(p.stats.morale + 1, 0, 100);
  }

  // Light free agency refresh
  if (state.freeAgents.length < 20) {
    state.freeAgents.push(createGeneratedPlayer());
    state.freeAgents.sort((a, b) => b.ovr - a.ovr);
  }

  state.trainingUsedThisWeek = 0;
  state.matchPlayedThisWeek = false;
  state.league.week += 1;

  if (state.league.week > RIVALS.seasonWeeks) {
    return { ok: true, seasonOver: true };
  }
  return { ok: true, seasonOver: false };
}

export function startNextSeason(state) {
  // Keep roster & budget, reset league
  const preserved = {
    roster: deepClone(state.team.roster),
    budget: Math.max(50000, state.budget + 80000),
    name: state.team.name,
    color: state.team.color,
  };

  const team = {
    id: state.team.id,
    name: preserved.name,
    color: preserved.color,
    roster: preserved.roster,
  };
  const league = createLeague(team);
  const slot = league.teams.find((t) => t.isPlayer);
  slot.roster = team.roster;

  state.season += 1;
  state.team = team;
  state.league = league;
  state.freeAgents = buildFreeAgencyPool(28);
  // Re-add unsigned signatures if released somehow — pool already has them
  state.budget = preserved.budget;
  state.ledger.unshift({
    week: 1,
    label: `Season ${state.season} TV rights bonus`,
    amount: 80000,
  });
  state.trainingUsedThisWeek = 0;
  state.matchPlayedThisWeek = false;
  return state;
}

export function officeSummary(state) {
  const ovr = teamOvr(state.team.roster);
  const morale = Math.round(teamAverage(state.team.roster, 'morale'));
  const energy = Math.round(teamAverage(state.team.roster, 'energy'));
  const fixture = getPlayerFixture(state.league, state.team.id);
  const slot = state.league.teams.find((t) => t.isPlayer);
  return {
    ovr,
    morale,
    energy,
    fixture,
    record: `${slot.w}–${slot.l}`,
    starters: startingFive(state.team.roster),
  };
}
