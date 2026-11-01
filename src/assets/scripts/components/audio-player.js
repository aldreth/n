const players = document.querySelectorAll('[data-audio-player]');

for (const player of players) {
  if (player.dataset.audioReady === 'true') continue;
  player.dataset.audioReady = 'true';

  const button = player.querySelector('[data-audio-play]');
  const audio = player.querySelector('audio');
  if (!button || !audio) continue;

  const setState = playing => {
    const action = playing ? 'Pause' : 'Play';
    button.setAttribute('aria-pressed', playing ? 'true' : 'false');
    const title = button.dataset.audioTitle || '';
    button.setAttribute('aria-label', title ? `${action} ${title}` : action);
    if (playing) button.setAttribute('data-playing', '');
    else button.removeAttribute('data-playing');
  };

  button.addEventListener('click', async () => {
    if (audio.paused) {
      document.querySelectorAll('[data-audio-player] audio').forEach(other => {
        if (other !== audio) other.pause();
      });
      setState(true);
      try {
        await audio.play();
      } catch {
        setState(false);
      }
    } else {
      audio.pause();
      setState(false);
    }
  });

  audio.addEventListener('play', () => setState(true));
  audio.addEventListener('pause', () => setState(false));
  audio.addEventListener('ended', () => setState(false));
}
