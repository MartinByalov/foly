// Decode a frame from the actual video without ever starting playback.
export function freezeBackground(video) {
  if (!video) return;
  const pause = () => video.pause();
  const seek = () => {
    pause();
    video.currentTime = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(0.1, video.duration / 2) : 0.1;
  };
  video.addEventListener('play', pause);
  video.addEventListener('seeked', pause);
  if (video.readyState >= 1) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
}