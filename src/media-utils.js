/**
 * Pure helpers shared by the plugin and its React views.
 * Kept as plain JS so Jest can exercise it without a TS transform.
 */

/** @typedef {"youtube" | "video" | "audio" | null} MediaKind */

const YOUTUBE_HOST_RE = /(?:^|\/\/)(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)(?:\/|$)/i;
const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|flac|opus|oga|mp4a)(?:\?|#|$)/i;
const VIDEO_EXT_RE = /\.(mp4|m4v|mov|webm|ogv|mkv|avi)(?:\?|#|$)/i;

/**
 * Strip [[wikilink]] and ![](markdown) wrappers from a frontmatter value.
 * @param {string} link
 * @returns {string}
 */
function stripLinkSyntax(link) {
	const value = String(link || "").trim();
	const wiki = value.match(/^\[\[([^\]|#]+)(?:#[^\]]*)?\]\]$/);
	if (wiki) return wiki[1].trim();
	const markdown = value.match(/^!?\[[^\]]*\]\(([^)]+)\)$/);
	if (markdown) return markdown[1].trim();
	return value;
}

/**
 * Work out which player backend a media_link should use.
 * @param {string} link
 * @returns {MediaKind}
 */
function classifyMedia(link) {
	const value = stripLinkSyntax(link);
	if (!value) return null;
	if (YOUTUBE_HOST_RE.test(value)) return "youtube";
	if (AUDIO_EXT_RE.test(value)) return "audio";
	if (VIDEO_EXT_RE.test(value)) return "video";
	return null;
}

/**
 * Extract a YouTube video id from watch / youtu.be / embed / shorts / live URLs.
 * @param {string} link
 * @returns {string | null}
 */
function getVideoId(link) {
	const value = String(link || "").trim();
	let url;
	try {
		url = new URL(value.startsWith("//") ? "https:" + value : value);
	} catch (_) {
		const loose = value.match(/(?:[?&]v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/i);
		return loose ? loose[1] : null;
	}

	const host = url.hostname.replace(/^(?:www\.|m\.)/i, "").toLowerCase();
	if (host === "youtu.be") {
		return url.pathname.split("/")[1] || null;
	}
	if (host === "youtube.com" || host === "youtube-nocookie.com") {
		const id = url.searchParams.get("v");
		if (id) return id;
		const pathId = url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/i);
		return pathId ? pathId[1] : null;
	}
	return null;
}

/**
 * Stable key used to remember the last playback position per media item.
 * @param {string} link
 * @returns {string}
 */
function getMediaId(link) {
	return getVideoId(link) || String(link || "");
}

/**
 * Parse a t= URL parameter, accepting both plain seconds and 1h2m3s form.
 * @param {string | null | undefined} raw
 * @returns {number | null}
 */
function parseTimeParam(raw) {
	if (raw === null || raw === undefined) return null;
	const value = String(raw).trim();
	if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
	const parts = value.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
	if (parts && (parts[1] || parts[2] || parts[3])) {
		return (
			Number(parts[1] || 0) * 3600 +
			Number(parts[2] || 0) * 60 +
			Number(parts[3] || 0)
		);
	}
	return null;
}

/**
 * Read the initial seek position from `?t=` or `#t=` in a media link.
 * @param {string} link
 * @returns {{ seconds: number | null, fromLink: boolean }}
 */
function getInitSecondsFromLink(link) {
	const value = String(link || "");
	let raw = null;
	try {
		const url = new URL(value.startsWith("//") ? "https:" + value : value);
		raw = url.searchParams.get("t");
		if (raw === null) {
			const hash = url.hash.match(/[?&]t=([^&]+)/i);
			raw = hash ? hash[1] : null;
		}
	} catch (_) {
		const match = value.match(/[?&#]t=([^&]+)/i);
		raw = match ? match[1] : null;
	}
	const seconds = parseTimeParam(raw);
	return seconds === null
		? { seconds: null, fromLink: false }
		: { seconds, fromLink: true };
}

/**
 * Resolve a vault-relative path to a URL the renderer can load.
 * @param {any} app
 * @param {string} rawPath
 * @returns {string | null}
 */
function resourcePathFor(app, rawPath) {
	const candidates = [rawPath];
	try {
		const decoded = decodeURIComponent(rawPath);
		if (decoded !== rawPath) candidates.push(decoded);
	} catch (_) {
		// leave the encoded form as the only candidate
	}
	for (const candidate of candidates) {
		const file = app?.vault?.getAbstractFileByPath?.(candidate);
		if (file && typeof file.extension === "string") {
			return app.vault.adapter?.getResourcePath?.(file.path) ?? null;
		}
	}
	return null;
}

/**
 * Turn a frontmatter media_link into a src usable by a <video>/<audio> tag.
 * Supports vault paths, [[wikilinks]], ![](markdown links), file://, app://
 * and remote http(s) URLs.
 * @param {any} app
 * @param {string} link
 * @returns {string | null}
 */
function resolveMediaSource(app, link) {
	const value = stripLinkSyntax(link);
	if (!value) return null;

	if (/^(?:app:|data:|blob:)/i.test(value)) return value;
	if (/^https?:\/\//i.test(value)) return value;

	if (/^file:\/\//i.test(value)) {
		let filePath;
		try {
			filePath = decodeURIComponent(new URL(value).pathname);
		} catch (_) {
			return null;
		}
		const basePath = app?.vault?.adapter?.basePath;
		if (basePath && filePath.startsWith(basePath + "/")) {
			const relative = filePath.slice(basePath.length + 1);
			return resourcePathFor(app, relative) ?? value;
		}
		return value;
	}

	// Absolute filesystem paths outside the vault: fall back to a file:// URL.
	if (/^\//.test(value) || /^[A-Za-z]:[\\/]/.test(value)) {
		const basePath = app?.vault?.adapter?.basePath;
		if (basePath && value.startsWith(basePath + "/")) {
			const relative = value.slice(basePath.length + 1);
			const inVault = resourcePathFor(app, relative);
			if (inVault) return inVault;
		}
		const normalized = value.replace(/\\/g, "/");
		return "file://" + encodeURI(normalized.startsWith("/") ? normalized : "/" + normalized);
	}

	return resourcePathFor(app, value);
}

module.exports = {
	classifyMedia,
	getVideoId,
	getMediaId,
	getInitSecondsFromLink,
	parseTimeParam,
	resolveMediaSource,
};
