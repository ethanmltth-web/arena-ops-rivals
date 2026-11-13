import { RIVALS } from './data/rivals.js';
import { TRAINING_SESSIONS, canTrain, runTraining } from './training.js';
import { standings, getPlayerFixture, getTeam } from './league.js';
import {
  signPlayer,
  releasePlayer,
  playPlayerMatch,
  advanceWeek,
  saveGame,
  weeklyPayroll,
  officeSummary,
  startNextSeason,
} from './state.js';
import { money } from './utils.js';

let state = null;
let agencyFilter = 'all';
let selectedTrainPlayer = null;
let selectedTrainSession = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

export function setState(s) {
  state = s;
}

export function getState() {
  return state;
}

export function showScreen(id) {
  $$('.screen').forEach((el) => el.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

export function showTab(tab) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $$('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab}`));
  renderTab(tab);
}

function renderTab(tab) {
  if (!state) return;
  if (tab === 'office') renderOffice();
  if (tab === 'roster') renderRoster();
  if (tab === 'agency') renderAgency();
  if (tab === 'training') renderTraining();
  if (tab === 'league') renderLeague();
  if (tab === 'match') renderMatch();
  if (tab === 'finances') renderFinances();
}

export function refreshHub() {
  if (!state) return;
  const summary = officeSummary(state);
  $('#hub-team-name').textContent = state.team.name;
  $('#hub-week').textContent = Math.min(state.league.week, RIVALS.seasonWeeks);
  $('#hub-season-weeks').textContent = RIVALS.seasonWeeks;
  $('#hub-budget').textContent = money(state.budget);
  $('#hub-record').textContent = summary.record;
  $('#hub-morale').textContent = `${summary.morale}`;
  $('#team-mark').style.background = state.team.color;
  document.documentElement.style.setProperty('--accent', state.team.color);

  const active = $('.tab.active')?.dataset.tab || 'office';
  renderTab(active);
}

function renderOffice() {
  const summary = officeSummary(state);
  const todos = [];
  if (!state.flags.signedAnyone) todos.push({ text: 'Scout free agency — chase a signature star if you can afford it', done: false });
  else todos.push({ text: 'Free agency visited', done: true });
  if (!state.flags.trainedOnce) todos.push({ text: 'Run a training session', done: false });
  else todos.push({ text: 'Training facility used', done: true });
  if (!state.matchPlayedThisWeek && summary.fixture && !summary.fixture.played) {
    todos.push({ text: 'Play this week’s league match', done: false });
  } else {
    todos.push({ text: 'Match day handled', done: true });
  }

  $('#office-brief').textContent = `Season ${state.season} · Team OVR ${summary.ovr}. Keep energy healthy and chase the top of the Rivals Pro League.`;
  $('#office-todos').innerHTML = todos.map((t) => `<li class="${t.done ? 'done' : ''}">${t.text}</li>`).join('');

  const box = $('#office-fixture');
  if (!summary.fixture) {
    box.innerHTML = `<strong>Bye week</strong><p class="muted">No match scheduled. Advance when ready.</p>`;
  } else {
    const home = getTeam(state.league, summary.fixture.homeId);
    const away = getTeam(state.league, summary.fixture.awayId);
    const status = summary.fixture.played
      ? `Final ${summary.fixture.score.home}–${summary.fixture.score.away}`
      : state.matchPlayedThisWeek
        ? 'Completed'
        : 'Upcoming — open Match Day';
    box.innerHTML = `
      <strong>${home.name} vs ${away.name}</strong>
      <p class="muted">${status}</p>
    `;
  }

  $('#office-quick').innerHTML = `
    <div><span>Team OVR</span><strong>${summary.ovr}</strong></div>
    <div><span>Avg Energy</span><strong>${summary.energy}</strong></div>
    <div><span>Payroll / wk</span><strong>${money(weeklyPayroll(state))}</strong></div>
    <div><span>Roster</span><strong>${state.team.roster.length}/${RIVALS.maxRoster}</strong></div>
  `;
}

function statBars(player) {
  return Object.keys(RIVALS.ovrWeights)
    .map((key) => {
      const val = player.stats[key];
      return `<div class="stat-row"><span>${RIVALS.statLabels[key]}</span><div class="bar"><i style="width:${val}%"></i></div><span>${val}</span></div>`;
    })
    .join('');
}

function playerCard(player, mode) {
  const meta = player.signature
    ? `★ Signature · Fee ${money(player.signingFee)}`
    : `Fee ${money(player.signingFee)}`;
  let actions = '';
  if (mode === 'agency') {
    actions = `<button class="btn btn-primary btn-sign" data-id="${player.id}">Sign</button>`;
  } else if (mode === 'roster') {
    actions = `
      <button class="btn btn-ghost btn-view" data-id="${player.id}">Details</button>
      <button class="btn btn-danger btn-release" data-id="${player.id}">Release</button>
    `;
  }
  return `
    <article class="player-card ${player.signature ? 'signature' : ''}" data-id="${player.id}">
      <div class="player-head">
        <div>
          <h4>${player.name}</h4>
          <span class="role-tag">${player.role}</span>
        </div>
        <div class="ovr">${player.ovr}</div>
      </div>
      <div class="stat-bars">${statBars(player)}</div>
      <div class="player-meta">
        <span>Morale ${player.stats.morale} · Energy ${player.stats.energy}</span>
        <span>${money(player.salary)}/wk</span>
      </div>
      <div class="player-meta"><span>${meta}</span><span>POT ${player.potential}</span></div>
      <div class="player-actions">${actions}</div>
    </article>
  `;
}

function renderRoster() {
  $('#roster-count').textContent = `${state.team.roster.length}/${RIVALS.maxRoster}`;
  const list = [...state.team.roster].sort((a, b) => b.ovr - a.ovr);
  $('#roster-list').innerHTML = list.map((p) => playerCard(p, 'roster')).join('') || '<p class="muted">No players.</p>';

  $('#roster-list').onclick = (e) => {
    const release = e.target.closest('.btn-release');
    const view = e.target.closest('.btn-view');
    if (release) {
      const res = releasePlayer(state, release.dataset.id);
      flash(res.message);
      refreshHub();
    }
    if (view) openPlayerModal(view.dataset.id);
  };
}

function renderAgency() {
  let list = [...state.freeAgents];
  if (agencyFilter === 'signature') list = list.filter((p) => p.signature);
  if (agencyFilter === 'affordable') list = list.filter((p) => p.signingFee <= state.budget);

  $('#agency-list').innerHTML = list.map((p) => playerCard(p, 'agency')).join('') || '<p class="muted">No agents match this filter.</p>';
  $('#agency-list').onclick = (e) => {
    const btn = e.target.closest('.btn-sign');
    if (!btn) return;
    const res = signPlayer(state, btn.dataset.id);
    flash(res.message);
    refreshHub();
  };
}

function renderTraining() {
  const select = $('#train-player-select');
  const roster = [...state.team.roster].sort((a, b) => b.ovr - a.ovr);
  select.innerHTML = roster.map((p) => `<option value="${p.id}">${p.name} · OVR ${p.ovr} · EN ${p.stats.energy}</option>`).join('');
  if (!selectedTrainPlayer || !roster.find((p) => p.id === selectedTrainPlayer)) {
    selectedTrainPlayer = roster[0]?.id || null;
  }
  select.value = selectedTrainPlayer || '';

  const player = roster.find((p) => p.id === selectedTrainPlayer);
  const preview = $('#train-player-preview');
  if (player) {
    preview.innerHTML = `
      <p><strong>${player.name}</strong> · ${player.role} · OVR ${player.ovr} / POT ${player.potential}</p>
      <div class="stat-bars">${statBars(player)}</div>
      <p class="tiny muted">Morale ${player.stats.morale} · Energy ${player.stats.energy} · Sessions left this week: ${3 - state.trainingUsedThisWeek}</p>
    `;
  } else preview.innerHTML = '';

  $('#train-options').innerHTML = TRAINING_SESSIONS.map((s) => {
    const selected = selectedTrainSession === s.id ? 'selected' : '';
    return `
      <button type="button" class="train-opt ${selected}" data-id="${s.id}">
        <span><strong>${s.name}</strong><br><small>${s.desc}</small></span>
        <small>${money(s.cost)} · ${s.energyCost ? `-${s.energyCost} EN` : '+EN'}</small>
      </button>
    `;
  }).join('');

  const session = TRAINING_SESSIONS.find((s) => s.id === selectedTrainSession);
  const check = canTrain(state, player, session);
  const runBtn = $('#btn-run-training');
  runBtn.disabled = !check.ok;
  runBtn.title = check.reason || '';
}

function renderLeague() {
  const rows = standings(state.league);
  const body = $('#standings-table tbody');
  body.innerHTML = rows
    .map((t, i) => {
      const you = t.isPlayer ? 'you' : '';
      return `<tr class="${you}"><td>${i + 1}</td><td>${t.name}${t.isPlayer ? ' (You)' : ''}</td><td>${t.w}</td><td>${t.l}</td><td>${t.diff > 0 ? '+' : ''}${t.diff}</td></tr>`;
    })
    .join('');

  const sched = $('#schedule-list');
  const items = [];
  state.league.schedule.forEach((weekFixtures, wi) => {
    const week = wi + 1;
    const mine = weekFixtures.find((f) => f.homeId === state.team.id || f.awayId === state.team.id);
    if (!mine) {
      items.push(`<div class="sched-item"><span>Week ${week}</span><span>Bye</span></div>`);
      return;
    }
    const home = getTeam(state.league, mine.homeId);
    const away = getTeam(state.league, mine.awayId);
    const score = mine.played ? `${mine.score.home}–${mine.score.away}` : 'vs';
    const cls = [
      mine.played ? 'played' : '',
      week === state.league.week ? 'current' : '',
    ].join(' ');
    items.push(`<div class="sched-item ${cls}"><span>Week ${week}: ${home.name} ${score} ${away.name}</span></div>`);
  });
  sched.innerHTML = items.join('');
}

function renderMatch() {
  const fixture = getPlayerFixture(state.league, state.team.id);
  const pre = $('#match-pre');
  const live = $('#match-live');
  const off = $('#match-off');

  live.classList.add('hidden');
  if (!fixture) {
    pre.classList.add('hidden');
    off.classList.remove('hidden');
    return;
  }
  off.classList.add('hidden');
  pre.classList.remove('hidden');

  const home = getTeam(state.league, fixture.homeId);
  const away = getTeam(state.league, fixture.awayId);
  const done = fixture.played || state.matchPlayedThisWeek;
  $('#match-preview').innerHTML = `
    <p><strong>${home.name}</strong> vs <strong>${away.name}</strong></p>
    <p class="muted">${done ? `Result: ${fixture.score ? `${fixture.score.home}–${fixture.score.away}` : 'Played'}` : 'Best of 3 · Pick a tactic and play.'}</p>
  `;
  $('#btn-play-match').disabled = done;
}

function renderFinances() {
  $('#finance-budget').textContent = money(state.budget);
  const payroll = weeklyPayroll(state);
  $('#finance-breakdown').innerHTML = `
    <li><span>Weekly payroll</span><strong>${money(payroll)}</strong></li>
    <li><span>Win prize</span><strong>${money(45000)}</strong></li>
    <li><span>Loss appearance</span><strong>${money(12000)}</strong></li>
    <li><span>Training sessions left</span><strong>${3 - state.trainingUsedThisWeek}</strong></li>
  `;
  $('#finance-ledger').innerHTML = state.ledger
    .slice(0, 40)
    .map((e) => {
      const cls = e.amount >= 0 ? 'pos' : 'neg';
      return `<div class="ledger-item"><span>W${e.week} · ${e.label}</span><span class="${cls}">${money(e.amount)}</span></div>`;
    })
    .join('');
}

function openPlayerModal(id) {
  const player = state.team.roster.find((p) => p.id === id) || state.freeAgents.find((p) => p.id === id);
  if (!player) return;
  $('#modal-body').innerHTML = `
    <h3>${player.name} ${player.signature ? '★' : ''}</h3>
    <p class="muted">${player.bio}</p>
    <p>Role: ${player.role} · Age ${player.age} · OVR ${player.ovr} · POT ${player.potential}</p>
    <div class="stat-bars" style="margin:0.8rem 0">${statBars(player)}
      <div class="stat-row"><span>Morale</span><div class="bar"><i style="width:${player.stats.morale}%"></i></div><span>${player.stats.morale}</span></div>
      <div class="stat-row"><span>Energy</span><div class="bar"><i style="width:${player.stats.energy}%"></i></div><span>${player.stats.energy}</span></div>
    </div>
    <p class="tiny muted">Salary ${money(player.salary)}/wk · Signing fee ${money(player.signingFee)}</p>
    <div class="row-actions"><button class="btn btn-ghost" id="modal-close">Close</button></div>
  `;
  $('#modal').classList.remove('hidden');
  $('#modal-close').onclick = () => $('#modal').classList.add('hidden');
}

function flash(msg) {
  const el = $('#save-status');
  if (el) {
    el.textContent = msg;
    setTimeout(() => {
      if (el.textContent === msg) el.textContent = '';
    }, 4000);
  }
  const train = $('#train-result');
  if (train && $('.tab[data-tab="training"]').classList.contains('active')) {
    train.textContent = msg;
  }
}

export function bindUI(handlers) {
  $('#btn-new-game').onclick = () => handlers.onNewGame();
  $('#btn-continue').onclick = () => handlers.onContinue();
  $('#btn-setup-back').onclick = () => showScreen('screen-title');
  $('#btn-start-career').onclick = () => {
    const name = $('#team-name-input').value;
    const color = $('#team-color-input').value;
    handlers.onStartCareer({ name, color });
  };

  $('#main-tabs').onclick = (e) => {
    const tab = e.target.closest('.tab');
    if (tab) showTab(tab.dataset.tab);
  };

  $$('.chip').forEach((chip) => {
    chip.onclick = () => {
      $$('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      agencyFilter = chip.dataset.filter;
      renderAgency();
    };
  });

  $('#train-player-select').onchange = (e) => {
    selectedTrainPlayer = e.target.value;
    renderTraining();
  };

  $('#train-options').onclick = (e) => {
    const opt = e.target.closest('.train-opt');
    if (!opt) return;
    selectedTrainSession = opt.dataset.id;
    renderTraining();
  };

  $('#btn-run-training').onclick = () => {
    const res = runTraining(state, selectedTrainPlayer, selectedTrainSession);
    if (res.ok) state.flags.trainedOnce = true;
    flash(res.message);
    refreshHub();
  };

  $('#btn-play-match').onclick = () => {
    const tactic = $('#match-tactic').value;
    const res = playPlayerMatch(state, tactic);
    if (!res.ok) {
      flash(res.message);
      return;
    }
    $('#match-pre').classList.add('hidden');
    $('#match-live').classList.remove('hidden');
    $('#match-scoreline').textContent = `${res.series.log[0]} · ${res.series.homeMaps}–${res.series.awayMaps}`;
    $('#match-log').innerHTML = res.series.log
      .map((line) => {
        let cls = '';
        if (line.startsWith('MAP')) cls = 'line-map';
        if (line.startsWith('FINAL') && res.won) cls = 'line-win';
        if (line.startsWith('FINAL') && !res.won) cls = 'line-loss';
        return `<div class="${cls}">${line}</div>`;
      })
      .join('');
    $('#btn-match-done').classList.remove('hidden');
    saveGame(state);
  };

  $('#btn-match-done').onclick = () => {
    $('#match-live').classList.add('hidden');
    $('#btn-match-done').classList.add('hidden');
    showTab('office');
    refreshHub();
  };

  $('#btn-advance-week').onclick = () => {
    const res = advanceWeek(state);
    if (!res.ok) {
      flash(res.message);
      return;
    }
    if (res.seasonOver) {
      const rows = standings(state.league);
      const place = rows.findIndex((t) => t.isPlayer) + 1;
      const you = rows.find((t) => t.isPlayer);
      $('#season-title').textContent = `Season ${state.season} Complete`;
      $('#season-summary').textContent = `You finished #${place} with a ${you.w}–${you.l} record (map diff ${you.diff > 0 ? '+' : ''}${you.diff}).`;
      $('#season-modal').classList.remove('hidden');
    } else {
      flash(`Advanced to week ${state.league.week}.`);
      saveGame(state);
      refreshHub();
    }
  };

  $('#btn-new-season').onclick = () => {
    startNextSeason(state);
    $('#season-modal').classList.add('hidden');
    saveGame(state);
    showTab('office');
    refreshHub();
    flash(`Season ${state.season} underway. TV bonus received.`);
  };

  $('#btn-save').onclick = () => {
    saveGame(state);
    flash('Career saved locally.');
  };

  $('#modal').onclick = (e) => {
    if (e.target.id === 'modal') $('#modal').classList.add('hidden');
  };
}
