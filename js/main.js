import { hasSave, loadGame, newCareer, saveGame } from './state.js';
import { bindUI, setState, showScreen, showTab, refreshHub } from './ui.js';

function boot() {
  const continueBtn = document.getElementById('btn-continue');
  continueBtn.disabled = !hasSave();

  bindUI({
    onNewGame() {
      showScreen('screen-setup');
    },
    onContinue() {
      const saved = loadGame();
      if (!saved) return;
      // Re-link player roster after JSON load (save stores two copies)
      const slot = saved.league?.teams?.find((t) => t.isPlayer);
      if (slot) slot.roster = saved.team.roster;
      setState(saved);
      showScreen('screen-hub');
      showTab('office');
      refreshHub();
    },
    onStartCareer({ name, color }) {
      const state = newCareer({ name, color });
      setState(state);
      saveGame(state);
      showScreen('screen-hub');
      showTab('office');
      refreshHub();
      document.getElementById('btn-continue').disabled = false;
    },
  });
}

boot();
