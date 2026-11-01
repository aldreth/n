import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const FORMATS = {
    m4a: {
        extension: 'm4a',
        sourceType: 'audio/mp4',
        codecArgs: bitrate => ['-c:a', 'aac', '-b:a', bitrate, '-movflags', '+faststart']
    },
    mp3: {
        extension: 'mp3',
        sourceType: 'audio/mpeg',
        codecArgs: bitrate => ['-c:a', 'libmp3lame', '-b:a', bitrate]
    },
    opus: {
        extension: 'opus',
        sourceType: 'audio/ogg',
        codecArgs: bitrate => ['-c:a', 'libopus', '-b:a', bitrate]
    }
};
/**
 * Default output name: the source basename, bitrate, and format.
 */
export function defaultFilenameFormat(id, src, bitrate, format) {
    const name = path.basename(src, path.extname(src));
    return `${name}-${bitrate}.${format}`;
}
/**
 * Transcode an audio file into one or more formats and bitrates.
 */
export default async function Audio(src, options = {}) {
    const { formats = ['m4a'], bitrates = ['96k'], sampleRate = 44100, outputDir = './dist/assets/audio/', urlPath = '/assets/audio/', filenameFormat = defaultFilenameFormat, ffmpegPath = ffmpegInstaller.path } = options;
    if (!formats.length) {
        throw new Error('Audio requires at least one format.');
    }
    if (!bitrates.length) {
        throw new Error('Audio requires at least one bitrate.');
    }
    const input = path.resolve(src);
    try {
        await stat(input);
    }
    catch {
        throw new Error(`Audio source not found: ${src}`);
    }
    const sourceHash = await hashFile(input);
    const id = sourceHash.slice(0, 8);
    const metadata = {};
    for (const format of formats) {
        const spec = FORMATS[format];
        if (!spec) {
            throw new Error(`Unsupported audio format "${format}". Use m4a, mp3, or opus.`);
        }
        metadata[format] = [];
        for (const rawBitrate of bitrates) {
            const bitrate = normalizeBitrate(rawBitrate);
            const filename = filenameFormat(id, input, bitrate, spec.extension, options);
            const outputPath = path.join(outputDir, filename);
            const cachePath = path.resolve('.cache/eleventy-audio', `${sha(path.resolve(outputPath))}.json`);
            const cacheKey = {
                hash: sourceHash,
                format,
                bitrate,
                sampleRate
            };
            await mkdir(path.dirname(outputPath), { recursive: true });
            const cachedSize = await cachedOutputSize(outputPath, cachePath, cacheKey);
            const size = cachedSize ??
                (await encode({
                    ffmpegPath,
                    input,
                    outputPath,
                    sampleRate,
                    codecArgs: spec.codecArgs(bitrate),
                    cachePath,
                    cacheKey
                }));
            metadata[format].push({
                url: joinUrl(urlPath, filename),
                outputPath,
                bitrate,
                format: spec.extension,
                sourceType: spec.sourceType,
                size
            });
        }
    }
    return metadata;
}
function normalizeBitrate(bitrate) {
    if (typeof bitrate === 'number')
        return `${bitrate}k`;
    const value = String(bitrate).trim();
    if (/^\d+$/.test(value))
        return `${value}k`;
    return value;
}
function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
function sha(value) {
    return createHash('sha256').update(value).digest('hex');
}
function joinUrl(urlPath, filename) {
    const base = urlPath.endsWith('/') ? urlPath : `${urlPath}/`;
    const relative = filename.split(path.sep).join('/');
    return `${base}${relative}`;
}
async function cachedOutputSize(outputPath, cachePath, cacheKey) {
    let cached;
    try {
        cached = JSON.parse(await readFile(cachePath, 'utf8'));
    }
    catch {
        return null;
    }
    if (JSON.stringify(cached.key) !== JSON.stringify(cacheKey))
        return null;
    try {
        return (await stat(outputPath)).size;
    }
    catch {
        return null;
    }
}
async function encode(job) {
    const args = [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        job.input,
        '-vn',
        '-ar',
        String(job.sampleRate),
        ...job.codecArgs,
        job.outputPath
    ];
    try {
        await runFfmpeg(job.ffmpegPath, args);
    }
    catch (error) {
        await rm(job.outputPath, { force: true });
        throw error;
    }
    const size = (await stat(job.outputPath)).size;
    await mkdir(path.dirname(job.cachePath), { recursive: true });
    await writeFile(job.cachePath, JSON.stringify({ key: job.cacheKey }));
    return size;
}
function runFfmpeg(ffmpegPath, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        const stderr = [];
        child.stderr?.on('data', (chunk) => stderr.push(chunk));
        child.on('error', reject);
        child.on('close', code => {
            if (code === 0) {
                resolve();
                return;
            }
            const detail = Buffer.concat(stderr).toString().trim();
            reject(new Error(detail || `ffmpeg exited with code ${code}`));
        });
    });
}
//# sourceMappingURL=audio.js.map
