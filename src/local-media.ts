import { readFileSync } from "fs";
import { extname } from "path";

const MIME_TYPES: Record<string, string> = {
	".mp3": "audio/mpeg",
	".m4a": "audio/mp4",
	".aac": "audio/aac",
	".wav": "audio/wav",
	".flac": "audio/flac",
	".opus": "audio/ogg",
	".oga": "audio/ogg",
	".mp4a": "audio/mp4",
	".mp4": "video/mp4",
	".m4v": "video/mp4",
	".mov": "video/quicktime",
	".webm": "video/webm",
	".ogv": "video/ogg",
	".mkv": "video/x-matroska",
	".avi": "video/x-msvideo",
};

const objectUrls = new Map<string, string>();

/**
 * Electron blocks file:// URLs inside the renderer, so files outside the
 * vault are read with Node and exposed to <audio>/<video> as blob URLs.
 */
export const createExternalMediaUrl = (filePath: string): string | null => {
	const cached = objectUrls.get(filePath);
	if (cached) return cached;
	try {
		const buffer = readFileSync(filePath);
		const type =
			MIME_TYPES[extname(filePath).toLowerCase()] ||
			"application/octet-stream";
		const url = URL.createObjectURL(
			new Blob([new Uint8Array(buffer)], { type })
		);
		objectUrls.set(filePath, url);
		return url;
	} catch (error) {
		console.error("Media Notes: could not read media file", filePath, error);
		return null;
	}
};

export const revokeExternalMediaUrl = (filePath: string): void => {
	const url = objectUrls.get(filePath);
	if (!url) return;
	URL.revokeObjectURL(url);
	objectUrls.delete(filePath);
};
