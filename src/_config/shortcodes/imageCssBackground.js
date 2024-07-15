import Image from '@11ty/eleventy-img';

function generateImages(src) {
  let options = {
    widths: [600, 800, 900, 1100, 1500, 2000],
    formats: ['webp'],
    outputDir: './dist/assets/cover-images/',
    urlPath: '/assets/cover-images/',
    useCache: true,
    sharpJpegOptions: {
      quality: 99,
      progressive: true
    }
  };
  // genrate images, ! dont wait
  Image(src, options);
  // get metadata even the image are not fully generated
  return Image.statsSync(src, options);
}

export function imageCssBackground(fileName) {
  const src = `./src/assets/images/cover-images/output/${fileName}.webp`;
  const metadata = generateImages(src);

  const selector = `.cover-image-${fileName}`;

  let markup = [`${selector} { background-image: url(${metadata.webp[0].url});} `];
  metadata.webp.slice(1).forEach((image, idx) => {
    markup.push(
      `@media (min-width: ${metadata.webp[idx].width}px) { ${selector} {background-image: url(${image.url});}}`
    );
  });
  return markup.join('');
}
