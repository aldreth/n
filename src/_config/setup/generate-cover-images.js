import fs from 'node:fs/promises';
import sharp from 'sharp';

const inputDir = 'src/assets/images/cover-images/input';
const outputDir = 'src/assets/images/cover-images/output';
const cssTemplatePath = 'src/_includes/head/cover-images.njk';

async function generateImages(imageNames) {
  await fs.mkdir(outputDir, {recursive: true});

  return await Promise.all(
    imageNames.map(async image => {
      const src = `${inputDir}/${image}.jpg`;
      const pic = await fs.readFile(src);
      await sharp(pic).ensureAlpha(0.5).webp({lossless: true}).toFile(`${outputDir}/${image}.webp`);
      console.log(`${image} done`);
    })
  );
}

async function generateCssTemplate(imageNames) {
  const templateEnd = `{% endset %}
<style>{{ css | safe }}</style>
`;

  const template = ['{% set css %}'];
  imageNames.map(image => template.push(`  {% imageCssBackground "${image}" %}`));
  template.push(templateEnd);

  return Promise.resolve(
    fs.writeFile(cssTemplatePath, template.join('\n')).then(() => console.log('css template written'))
  );
}

async function main() {
  await fs.mkdir(outputDir, {recursive: true});

  let images = await fs.readdir(inputDir, {withFileTypes: true});

  const imageNames = images
    .filter(item => !item.isDirectory())
    .map(item => item.name)
    .filter(f => f.match('.jpg'))
    .map(f => f.replace('.jpg', ''));

  await Promise.all([generateImages(imageNames), generateCssTemplate(imageNames)]);

  console.log('All done');
}

main();
