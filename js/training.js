import { RIVALS } from './data/rivals.js';
import { refreshPlayerOvr } from './players.js';
import { clamp, randInt } from './utils.js';

export const TRAINING_SESSIONS = [
  {
    id: 'aim-lab',
    name: 'Aim Lab',
    stat: 'aim',
    cost: 3500,
    energyCost: 12,
    gain: [1, 3],
    desc: 'Flick drills and tracking bots.',
  },
  {
    id: 'movement',
    name: 'Movement Tech',
    stat: 'movement',
    cost: 3000,
    energyCost: 14,
    gain: [1, 3],
    desc: 'Strafes, peeks, and pathing routes.',
  },
  {
    id: 'mechanics',
    name: 'Mechanics Block',
    stat: 'mechanics',
    cost: 4000,
    energyCost: 13,
    gain: [1, 3],
    desc: 'Ability combos and weapon mastery.',
  },
  {
    id: 'vod',
    name: 'VOD Review',
    stat: 'gameSense',
    cost: 2500,
    energyCost: 8,
    gain: [1, 3],
    desc: 'Study timings, defaults, and reads.',
  },
  {
    id: 'scrim',
    name: 'Team Scrim',
    stat: 'teamwork',
    cost: 5000,
    energyCost: 15,
    gain: [1, 4],
    desc: 'Full team practice — boosts teamwork.',
    teamWide: true,
  },
  {
    id: 'rest',
    name: 'Recovery Day',
    stat: 'energy',
    cost: 1000,
    energyCost: 0,
    gain: [12, 22],
    desc: 'Restores energy and a bit of morale.',
    restore: true,
  },
];

export function canTrain(state, player, session) {
  if (!player || !session) return { ok: false, reason: 'Pick a player and session.' };
  if (state.budget < session.cost) return { ok: false, reason: 'Not enough budget.' };
  if (!session.restore && player.stats.energy < session.energyCost + 5) {
    return { ok: false, reason: 'Player is too exhausted. Run Recovery Day first.' };
  }
  if (state.trainingUsedThisWeek >= 3) {
    return { ok: false, reason: 'Training cap hit (3 sessions this week).' };
  }
  return { ok: true };
}

export function runTraining(state, playerId, sessionId) {
  const session = TRAINING_SESSIONS.find((s) => s.id === sessionId);
  const player = state.team.roster.find((p) => p.id === playerId);
  const check = canTrain(state, player, session);
  if (!check.ok) return { ok: false, message: check.reason };

  state.budget -= session.cost;
  state.ledger.unshift({
    week: state.league.week,
    label: `Training: ${session.name} (${player.name})`,
    amount: -session.cost,
  });
  state.trainingUsedThisWeek += 1;

  const gain = randInt(session.gain[0], session.gain[1]);
  let message = '';

  if (session.restore) {
    player.stats.energy = clamp(player.stats.energy + gain, 0, 100);
    player.stats.morale = clamp(player.stats.morale + randInt(1, 4), 0, 100);
    message = `${player.name} recovered +${gain} energy.`;
  } else if (session.teamWide) {
    for (const p of state.team.roster) {
      const g = randInt(session.gain[0], session.gain[1]);
      const beforeCap = p.stats[session.stat];
      const softCap = Math.min(99, p.potential);
      p.stats[session.stat] = clamp(beforeCap + g, 0, softCap);
      p.stats.energy = clamp(p.stats.energy - session.energyCost, 10, 100);
      refreshPlayerOvr(p);
    }
    message = `Team scrim complete. Teamwork improved across the roster (+~${gain}).`;
  } else {
    const softCap = Math.min(99, player.potential);
    const before = player.stats[session.stat];
    // Diminishing returns near potential
    const effective = before >= softCap - 3 ? Math.max(1, Math.floor(gain / 2)) : gain;
    player.stats[session.stat] = clamp(before + effective, 0, softCap);
    player.stats.energy = clamp(player.stats.energy - session.energyCost, 10, 100);
    player.stats.morale = clamp(player.stats.morale + randInt(0, 2), 0, 100);
    refreshPlayerOvr(player);
    const label = RIVALS.statLabels[session.stat] || session.stat;
    message = `${player.name}: ${label} ${before} → ${player.stats[session.stat]} (OVR ${player.ovr}).`;
  }

  return { ok: true, message };
}
