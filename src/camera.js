// Harness-only camera passthrough: rear camera behind the HUD so the phone
// becomes an AR preview (and demo-footage rig). Never runs on glasses —
// camera isn't exposed there; the additive display is "passthrough" already.
//
// Note: the HUD projects ±7° (glasses FOV) across the frame while the phone
// camera sees ~±35°, so pins read directionally correct but compressed
// toward center relative to the video.
import { toast } from './render.js';

let stream = null;

export async function toggleCamera() {
  const video = document.getElementById('cam');
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
    stream = null;
    video.srcObject = null;
    video.hidden = true;
    document.body.classList.remove('cam-on');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = stream;
    video.hidden = false;
    document.body.classList.add('cam-on');
  } catch {
    toast('CAMERA UNAVAILABLE');
  }
}

export function initCameraButton() {
  const btn = document.getElementById('cam-btn');
  btn.hidden = false;
  btn.addEventListener('click', toggleCamera);
}
