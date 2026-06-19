// Ride UI: one START button → timer, one STOP button.
import { startRide, endRide } from './ride.js';

export function initRideUI() {
  document.getElementById('start-ride-btn').addEventListener('click', () => {
    startRide();
  });
  document.getElementById('stop-btn').addEventListener('click', () => {
    endRide();
  });
}
