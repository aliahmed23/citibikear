// Ride UI: unlock button, bike-type modal, end-ride button.
import { CONFIG } from './config.js';
import { startRide, endRide } from './ride.js';

let selectedPlan = 'single';

function updatePriceLabels() {
  document.getElementById('classic-pricing').textContent =
    CONFIG.PRICING[selectedPlan].classic.label;
  document.getElementById('ebike-pricing').textContent =
    CONFIG.PRICING[selectedPlan].ebike.label;
}

export function initRideUI() {
  const modal      = document.getElementById('ride-modal');
  const unlockBtn  = document.getElementById('unlock-btn');
  const planSingle = document.getElementById('plan-single');
  const planMember = document.getElementById('plan-member');
  const typeClassic = document.getElementById('type-classic');
  const typeEbike   = document.getElementById('type-ebike');
  const cancelBtn  = document.getElementById('ride-modal-cancel');
  const endBtn     = document.getElementById('end-ride-btn');

  unlockBtn.addEventListener('click', () => {
    updatePriceLabels();
    modal.hidden = false;
    typeClassic.focus();
  });

  planSingle.addEventListener('click', () => {
    selectedPlan = 'single';
    planSingle.classList.add('active');
    planMember.classList.remove('active');
    updatePriceLabels();
  });

  planMember.addEventListener('click', () => {
    selectedPlan = 'member';
    planMember.classList.add('active');
    planSingle.classList.remove('active');
    updatePriceLabels();
  });

  typeClassic.addEventListener('click', () => {
    startRide('classic', selectedPlan);
    modal.hidden = true;
  });

  typeEbike.addEventListener('click', () => {
    startRide('ebike', selectedPlan);
    modal.hidden = true;
  });

  cancelBtn.addEventListener('click', () => { modal.hidden = true; });
  endBtn.addEventListener('click', () => { endRide(); });
}
