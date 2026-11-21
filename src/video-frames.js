// Reading many frames of a video quickly. Seeking to every frame is slow (each seek decodes from
// the previous keyframe), so frames are taken while the video plays (faster than real time),
// using requestVideoFrameCallback to know the exact source time of each frame. Browsers without
// it fall back to seeking.

export function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error('Could not read the video'));
    v.src = url;
  });
}

export function seekTo(v, t) {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2 && !v.seeking) return resolve();
    const done = () => {
      clearTimeout(to);
      v.removeEventListener('seeked', done);
      resolve();
    };
    const to = setTimeout(done, 4000);
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

export const canPlayCapture = (v) => typeof v.requestVideoFrameCallback === 'function';

/**
 * Play v from `from` to `to` at `rate`, calling onFrame(mediaTime) for every frame shown (the
 * frame can be drawn from v inside the call). Resolves true when `to` is reached, false if the
 * video stalled (the caller should fall back to seeking for what is missing).
 */
export async function playCapture(v, from, to, onFrame, { rate = 2 } = {}) {
  if (!canPlayCapture(v)) return false;
  await seekTo(v, Math.max(0, from));
  return new Promise((resolve) => {
    let done = false;
    let last = performance.now();
    const finish = (ok) => {
      if (done) return;
      done = true;
      clearInterval(watch);
      v.pause();
      v.onended = null;
      resolve(ok);
    };
    const cb = (_now, md) => {
      if (done) return;
      last = performance.now();
      onFrame(md.mediaTime);
      if (md.mediaTime >= to - 1e-3) return finish(true);
      v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
    v.onended = () => finish(true);
    const watch = setInterval(() => {
      if (performance.now() - last > 2500) finish(false);
    }, 250);
    v.playbackRate = rate;
    v.play().catch(() => finish(false));
  });
}
