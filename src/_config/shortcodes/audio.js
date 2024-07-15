import Image from '@11ty/eleventy-img';
import path from 'node:path';
import fs from 'node:fs/promises';
import htmlmin from 'html-minifier-terser';

/**
 * Converts an attribute map object to a string of HTML attributes.
 * @param {Object} attributeMap - The attribute map object.
 * @returns {string} - The string of HTML attributes.
 */
const stringifyAttributes = attributeMap => {
  return Object.entries(attributeMap)
    .map(([attribute, value]) => {
      if (typeof value === 'undefined') return '';
      return `${attribute}="${value}"`;
    })
    .join(' ');
};

/**
 * Generates an HTML audio element with player, download link and optional caption.
 * @param {string} src - The path to the image source file.
 * @param {string} [alt=''] - The alternative text for the image.
 * @param {string} [caption=''] - The caption for the image.
//  * @param {string} [loading='lazy'] - The loading attribute for the image.
 * @param {string} [className] - The CSS class name for the image element.
 * @param {string} [sizes='90vw'] - The sizes attribute for the image.
 * @param {number[]} [widths=[440, 650, 960, 1200]] - The widths for generating responsive images.
 * @param {string[]} [formats=['avif', 'webp', 'jpeg']] - The formats for generating responsive images.
 * @returns {string} - The HTML image element.
 */
export const audioShortcode = async (src, caption = '', className = '') => {
  const outputDir = './dist/assets/audio/';
  const htmlOutputDir = '/assets/audio/';

  // Getting the URL to use
  // let imgSrc = src;
  // if (!imgSrc.startsWith('.')) {
  //     const inputPath = this.page.inputPath;
  //     const pathParts = inputPath.split('/');
  //     pathParts.pop();
  //     imgSrc = `${pathParts.join('/')}/${src}`;
  // }
  const outputPath = outputDir + src;
  const htmlOutputPath = htmlOutputDir + src;

  const inputPath = `src/assets/audio/${src}`;
  await fs.mkdir(outputDir, {recursive: true});
  await fs.copyFile(inputPath, outputPath);

  const audioElement = caption
    ? `<figure slot="audio" class="flow ${className ? `${className}` : ''}">
            <figcaption>${caption}</figcaption>
            <audio controls>
                <source src="${htmlOutputPath}" type="audio/mp4" />
            </audio>
            <a href="${htmlOutputPath}">Download audio</a>
        </figure>`
    : `<figure slot="audio" class="flow ${className ? `${className}` : ''}">
            <audio controls>
                <source src="${htmlOutputPath}" type="audio/mp4" />
            </audio>
            <a href="${htmlOutputPath}">Download audio</a>
        </figure>`;

  return htmlmin.minify(audioElement, {collapseWhitespace: true});
};
