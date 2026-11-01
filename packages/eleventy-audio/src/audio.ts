import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

interface FfmpegInstallerModule {
  path: string;
}

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg') as FfmpegInstallerModule;

export type AudioFormat = 'm4a' | 'mp3' | 'opus';

export interface AudioOptions {
  /** `m4a`, `mp3`, or `opus`. */
  formats?: AudioFormat[];
  /** Bitrate is the size control, in the same role as widths in eleventy-img. */
  bitrates?: Array<string | number>;
  sampleRate?: number;
  outputDir?: string;
  urlPath?: string;
  filenameFormat?: FilenameFormat;
  ffmpegPath?: string;
}

/**
 * `id` is a short content hash, available if a caller wants it in the name.
 * `format` is the output extension.
 */
export type FilenameFormat = (
  id: string,
  src: string,
  bitrate: string,
  format: string,
  options: AudioOptions
) => string;

export interface AudioFile {
  url: string;
  outputPath: string;
  bitrate: string;
  format: string;
  sourceType: string;
  size: number;
}

export type AudioMetadata = Record<string, AudioFile[]>;

interface FormatSpec {
  extension: string;
  sourceType: string;
  codecArgs: (bitrate: string) => readonly string[];
}

interface CacheKey {
  hash: string;
  format: AudioFormat;
  bitrate: string;
  sampleRate: number;
}

interface CacheFile {
  key: CacheKey;
}

interface EncodeJob {
  ffmpegPath: string;
  input: string;
  outputPath: string;
  sampleRate: number;
  codecArgs: readonly string[];
  cachePath: string;
  cacheKey: CacheKey;
}

const FORMATS: Record<AudioFormat, FormatSpec> = {
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
export function defaultFilenameFormat(id: string, src: string, bitrate: string, format: string): string {
  const name = path.basename(src, path.extname(src));
  return `${name}-${bitrate}.${format}`;
}

/**
 * Transcode an audio file into one or more formats and bitrates.
 */
export default async function Audio(src: string, options: AudioOptions = {}): Promise<AudioMetadata> {
  const {
    formats = ['m4a'],
    bitrates = ['96k'],
    sampleRate = 44100,
    outputDir = './dist/assets/audio/',
    urlPath = '/assets/audio/',
    filenameFormat = defaultFilenameFormat,
    ffmpegPath = ffmpegInstaller.path
  } = options;

  if (!formats.length) {
    throw new Error('Audio requires at least one format.');
  }
  if (!bitrates.length) {
    throw new Error('Audio requires at least one bitrate.');
  }

  const input = path.resolve(src);
  try {
    await stat(input);
  } catch {
    throw new Error(`Audio source not found: ${src}`);
  }

  const sourceHash = await hashFile(input);
  const id = sourceHash.slice(0, 8);
  const metadata: AudioMetadata = {};

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
      const cacheKey: CacheKey = {
        hash: sourceHash,
        format,
        bitrate,
        sampleRate
      };

      await mkdir(path.dirname(outputPath), {recursive: true});

      const cachedSize = await cachedOutputSize(outputPath, cachePath, cacheKey);
      const size =
        cachedSize ??
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

function normalizeBitrate(bitrate: string | number): string {
  if (typeof bitrate === 'number') return `${bitrate}k`;
  const value = String(bitrate).trim();
  if (/^\d+$/.test(value)) return `${value}k`;
  return value;
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function joinUrl(urlPath: string, filename: string): string {
  const base = urlPath.endsWith('/') ? urlPath : `${urlPath}/`;
  const relative = filename.split(path.sep).join('/');
  return `${base}${relative}`;
}

async function cachedOutputSize(
  outputPath: string,
  cachePath: string,
  cacheKey: CacheKey
): Promise<number | null> {
  let cached: CacheFile;
  try {
    cached = JSON.parse(await readFile(cachePath, 'utf8')) as CacheFile;
  } catch {
    return null;
  }

  if (JSON.stringify(cached.key) !== JSON.stringify(cacheKey)) return null;

  try {
    return (await stat(outputPath)).size;
  } catch {
    return null;
  }
}

async function encode(job: EncodeJob): Promise<number> {
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
  } catch (error) {
    await rm(job.outputPath, {force: true});
    throw error;
  }

  const size = (await stat(job.outputPath)).size;
  await mkdir(path.dirname(job.cachePath), {recursive: true});
  await writeFile(job.cachePath, JSON.stringify({key: job.cacheKey}));
  return size;
}

function runFfmpeg(ffmpegPath: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {stdio: ['ignore', 'ignore', 'pipe']});
    const stderr: Buffer[] = [];
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
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
