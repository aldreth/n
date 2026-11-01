import Image from '@11ty/eleventy-img';
import path from 'node:path';
import htmlmin from 'html-minifier-terser';
import Audio from 'eleventy-audio';

/**
 * @param {string} value
 * @returns {string}
 */
const escapeHtml = value =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Bare filenames are read from src/assets/audio. Paths are used as given.
 * @param {string} src
 * @returns {string}
 */
const resolveAudioSrc = src => {
  if (src.startsWith('.') || path.isAbsolute(src) || src.includes('/')) return src;
  return path.join('src/assets/audio', src);
};

/**
 * @param {string} cover
 * @param {string} alt
 * @returns {Promise<string>}
 */
const coverMarkup = async (cover, alt) => {
  if (!cover) return '';

  const metadata = await Image(cover, {
    widths: [640],
    formats: ['webp', 'jpeg'],
    urlPath: '/assets/images/',
    outputDir: './dist/assets/images/',
    filenameFormat: (id, src, width, format) => {
      const extension = path.extname(src);
      const name = path.basename(src, extension);
      return `${name}-${width}w.${format}`;
    }
  });

  const jpeg = metadata.jpeg[metadata.jpeg.length - 1];
  const webp = metadata.webp?.[0];
  const webpSource = webp
    ? `<source type="${webp.sourceType}" srcset="${webp.url}">`
    : '';

  return `<picture class="audio-player__picture">
      ${webpSource}
      <img class="audio-player__cover" src="${jpeg.url}" width="${jpeg.width}" height="${jpeg.height}" alt="${alt}" loading="lazy" decoding="async">
    </picture>`;
};

/**
 * Project audio player: cover, title, description, play/pause, and download.
 * Transcoding is done by eleventy-audio; this function only returns HTML.
 * @param {string} src
 * @param {string} [title]
 * @param {string} [description]
 * @param {string} [cover]
 * @returns {Promise<string>}
 */
export const audioShortcode = async (src, title = '', description = '', cover = '') => {
  const metadata = await Audio(resolveAudioSrc(src), {
    formats: ['m4a'],
    bitrates: ['96k'],
    sampleRate: 44100,
    outputDir: './dist/assets/audio/',
    urlPath: '/assets/audio/'
  });
  const file = metadata.m4a[0];
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const coverHtml = await coverMarkup(cover, safeTitle);

  const descriptionHtml = safeDescription
    ? `<p class="audio-player__description">${safeDescription}</p>`
    : '';
  const playLabel = safeTitle ? `Play ${safeTitle}` : 'Play';
  const downloadLabel = safeTitle ? `Download ${safeTitle}` : 'Download';

  const player = `<figure class="audio-player" data-audio-player>
      ${coverHtml}
      <div class="audio-player__body">
        <p class="audio-player__title">${safeTitle}</p>
        ${descriptionHtml}
      </div>
      <div class="audio-player__controls">
        <button type="button" class="button" data-audio-play data-audio-title="${safeTitle}" aria-pressed="false" aria-label="${playLabel}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-audio-icon="play"><path d="M8 5.14v13.72c0 .79.87 1.27 1.54.84l10.68-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14z"/></svg>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" data-audio-icon="pause"><path d="M6 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm8 0h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/></svg>
        </button>
        <a class="button" href="${file.url}" download aria-label="${downloadLabel}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1z"/><path d="M5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z"/></svg>
        </a>
      </div>
      <audio hidden preload="none" src="${file.url}"></audio>
      <script type="module" src="/assets/scripts/components/audio-player.js?v=3"></script>
    </figure>`;

  return htmlmin.minify(player, {collapseWhitespace: true});
};
