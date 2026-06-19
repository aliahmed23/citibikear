// Input: Neural Band / captouch arrive as Arrow + Enter keydown.
// Map:
//   Left/Right  -> cycle focus by bearing (or nudge offset in calibration)
//   Enter       -> open/close detail card on focused pin
//   c (harness) -> toggle calibration state
//   v (harness) -> camera passthrough
import { state, markActivity } from './state.js';
import { setCalibrationOffset } from './heading.js';
import { cycleFocus, toast } from './render.js';
import { toggleCamera } from './camera.js';

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
    case 'ArrowLeft':
      if (!state.detailOpen) cycleFocus(-1);
      break;
    case 'ArrowRight':
      if (!state.detailOpen) cycleFocus(1);
      break;
    case 'Enter':
      if (state.nearby.length) state.detailOpen = !state.detailOpen;
      break;
    case 'c':
      state.detailOpen = false;
      state.calibrating = true;
      toast('AIM AT A KNOWN STATION, NUDGE ◀▶');
      break;
    case 'v':
      toggleCamera();
      break;
  }
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    if (!document.getElementById('start-screen').hidden) return;
    if (['ArrowLeft', 'ArrowRight', 'Enter', 'c', 'v'].includes(e.key)) {
      e.preventDefault();
      handleKey(e.key);
    }
  });
}
