import { AI_TEAM_NAMES, RIVALS } from './data/rivals.js';
import { generateAiRoster, teamOvr } from './players.js';
import { pick, uid } from './utils.js';

export function createLeague(playerTeam) {
  const names = [...AI_TEAM_NAMES].sort(() => Math.random() - 0.5).slice(0, 7);
  const strengths = [78, 74, 72, 70, 68, 65, 62];
  const teams = [
    {
      id: playerTeam.id,
      name: playerTeam.name,
      color: playerTeam.color,
      isPlayer: true,
      roster: playerTeam.roster,
      w: 0,
      l: 0,
      diff: 0,
    },
  ];

  names.forEach((name, i) => {
    const roster = generateAiRoster(strengths[i] || 66);
    teams.push({
      id: uid('ai'),
      name,
      color: pick(['#ff6b2c', '#4da3ff', '#f5c542', '#c084fc', '#fb7185', '#34d399', '#94a3b8']),
      isPlayer: false,
      roster,
      strength: teamOvr(roster),
      w: 0,
      l: 0,
      diff: 0,
    });
  });

  const schedule = buildRoundRobin(teams.map((t) => t.id), RIVALS.seasonWeeks);
  return { teams, schedule, week: 1 };
}

/** Build weekly fixtures for `weeks`. Each week every team plays at most once. */
function buildRoundRobin(teamIds, weeks) {
  const ids = [...teamIds];
  if (ids.length % 2 === 1) ids.push(null); // bye pad (shouldn't happen with 8)

  const n = ids.length;
  const rounds = [];
  const rotating = ids.slice(1);

  for (let round = 0; round < n - 1; round++) {
    const circle = [ids[0], ...rotating];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      if (a && b) pairs.push({ homeId: a, awayId: b });
    }
    rounds.push(pairs);
    rotating.unshift(rotating.pop());
  }

  // Repeat / trim to season length
  const schedule = [];
  for (let w = 0; w < weeks; w++) {
    const base = rounds[w % rounds.length].map((p) => ({
      ...p,
      // flip home/away on second cycle
      homeId: w >= rounds.length ? p.awayId : p.homeId,
      awayId: w >= rounds.length ? p.homeId : p.awayId,
      week: w + 1,
      played: false,
      score: null,
    }));
    schedule.push(base);
  }
  return schedule;
}

export function getWeekFixtures(league, week = league.week) {
  return league.schedule[week - 1] || [];
}

export function getPlayerFixture(league, playerTeamId, week = league.week) {
  return getWeekFixtures(league, week).find(
    (f) => f.homeId === playerTeamId || f.awayId === playerTeamId
  ) || null;
}

export function getTeam(league, id) {
  return league.teams.find((t) => t.id === id);
}

export function standings(league) {
  return [...league.teams].sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return a.name.localeCompare(b.name);
  });
}

export function applyMatchResult(league, fixture, homeMaps, awayMaps) {
  const home = getTeam(league, fixture.homeId);
  const away = getTeam(league, fixture.awayId);
  fixture.played = true;
  fixture.score = { home: homeMaps, away: awayMaps };

  const homeWon = homeMaps > awayMaps;
  if (homeWon) {
    home.w += 1;
    away.l += 1;
  } else {
    away.w += 1;
    home.l += 1;
  }
  home.diff += homeMaps - awayMaps;
  away.diff += awayMaps - homeMaps;
}
