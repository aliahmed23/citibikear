// Input (PRD §4.2, §5.4): Neural Band + captouch arrive as ArrowUp/Down/
// Left/Right + Enter keydown. Desktop keyboard matches 1:1; phone gets an
// on-screen D-pad that synthesizes the same handling.
//
// Map:
//   Up/Down     -> bike mode / dock mode
//   Left/Right  -> cycle focus by bearing (or nudge offset in calibration)
//   Enter       -> open/close detail card on focused pin
//   c (harness) -> toggle calibration state (glasses entry point TBD on-device)
import { state, markActivity } from './state.js';
import { setCalibrationOffset } from './heading.js';
import { cycleFocus, toast } from './render.js';
import { toggleCamera } from './camera.js';

const MODES = ['bike', 'ebike', 'dock'];
const MODE_TOAST = { bike: 'ALL BIKES', ebike: 'E-BIKES', dock: 'DOCKS' };

export function cycleMode(dir) {
  const i = MODES.indexOf(state.mode);
  state.mode = MODES[(i + dir + MODES.length) % MODES.length];
  toast(MODE_TOAST[state.mode]);
}

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
      cycleMode(-1);
      break;
    case 'ArrowDown':
      cycleMode(1);
      break;
    case 'ArrowLeft':
      if (!state.detailOpen) cycleFocus(-1);
      break;
    case 'ArrowRight':
      if (!state.detailOpen) cycleFocus(1);
      break;
    case 'Enter':
      if (state.nearby.length) state.detailOpen = !state.detailOpen;
      break;
    case 'c': // dev harness only
      state.detailOpen = false;
      state.calibrating = true;
      toast('AIM AT A KNOWN STATION, NUDGE ◀▶');
      break;
    case 'v': // dev harness only: camera passthrough
      toggleCamera();
      break;
  }
}

export function initInput({ showDpad }) {
  window.addEventListener('keydown', (e) => {
    // Let the start screen's native button handle Enter.
    if (!document.getElementById('start-screen').hidden) return;
    // Let the ride modal handle its own button focus.
    if (!document.getElementById('ride-modal').hidden) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'c', 'v'].includes(e.key)) {
      e.preventDefault();
      handleKey(e.key);
    }
  });

  // Mode chip in the status row doubles as a tap/click toggle.
  document.getElementById('status-mode').addEventListener('click', () => {
    markActivity();
    cycleMode(1);
  });

  if (showDpad) {
    const dpad = document.getElementById('dpad');
    dpad.hidden = false;
    dpad.addEventListener('click', (e) => {
      const key = e.target.closest('button')?.dataset.key;
      if (key) handleKey(key);
    });
  }
}
