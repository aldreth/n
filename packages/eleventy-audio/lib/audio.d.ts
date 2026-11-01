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
export type FilenameFormat = (id: string, src: string, bitrate: string, format: string, options: AudioOptions) => string;
export interface AudioFile {
    url: string;
    outputPath: string;
    bitrate: string;
    format: string;
    sourceType: string;
    size: number;
}
export type AudioMetadata = Record<string, AudioFile[]>;
/**
 * Default output name: the source basename, bitrate, and format.
 */
export declare function defaultFilenameFormat(id: string, src: string, bitrate: string, format: string): string;
/**
 * Transcode an audio file into one or more formats and bitrates.
 */
export default function Audio(src: string, options?: AudioOptions): Promise<AudioMetadata>;
//# sourceMappingURL=audio.d.ts.map