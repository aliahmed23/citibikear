// Input: Neural Band / captouch arrive as Arrow + Enter keydown.
// Up/Down  -> cycle mode selector (BIKES / DOCKS / START)
// Left/Right -> cycle pin focus by bearing (or nudge offset in calibration)
// Enter    -> activate focused mode, or open/close detail card
// c (harness) -> toggle calibration state
import { state, markActivity } from './state.js';
import { setCalibrationOffset } from './heading.js';
import { cycleFocus, toast, cycleModeSelector, getFocusedTrackMode, refreshModeLabels } from './render.js';

let onActivate = null;

export function handleKey(key) {
  markActivity();

  if (state.calibrating) {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      state.calibrationOffset += key === 'ArrowLeft' ? -1 : 1;
      setCalibrationOffset(state.calibrationOffset);
      return;
    }
    if (key === 'Enter' || key === 'c') {
      state.calibrating = false;
      toast('CALIBRATION SAVED');
      return;
    }
    return;
  }

  switch (key) {
    case 'ArrowUp':
      cycleModeSelector(-1);
      break;
    case 'ArrowDown':
      cycleModeSelector(1);
      break;
    case 'ArrowLeft':
      if (!state.detailOpen) {
        const mL = getFocusedTrackMode();
        if (mL === null) { state.modeIndex = 0; refreshModeLabels(); }
        else if (mL === 'view') { state.viewMode = 0; refreshModeLabels(); }
        else cycleFocus(-1);
      }
      break;
    case 'ArrowRight':
      if (!state.detailOpen) {
        const mR = getFocusedTrackMode();
        if (mR === null) { state.modeIndex = 1; refreshModeLabels(); }
        else if (mR === 'view') { state.viewMode = 1; refreshModeLabels(); }
        else cycleFocus(1);
      }
      break;
    case 'Enter':
      if (state.detailOpen) {
        state.detailOpen = false;
      } else if (state.modeIndex === 2) {
        // START mode: toggle timer
        onActivate?.(2);
      } else if (!state.started) {
        onActivate?.(state.modeIndex);
      } else if (state.nearby.length) {
        state.detailOpen = true;
      }
      break;
    case 'c':
      state.detailOpen = false;
      state.calibrating = true;
      toast('AIM AT A KNOWN STATION, NUDGE ◀▶');
      break;
  }
}

export function initInput({ onActivate: cb }) {
  onActivate = cb;

  window.addEventListener('keydown', (e) => {
    const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'c'];
    if (KEYS.includes(e.key)) {
      e.preventDefault();
      handleKey(e.key);
    }
  });
}
