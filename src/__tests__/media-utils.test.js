const {
	classifyMedia,
	getVideoId,
	getMediaId,
	getInitSecondsFromLink,
	parseTimeParam,
	resolveMediaSource,
} = require("../media-utils");

describe("classifyMedia", () => {
	test("recognizes YouTube URLs including youtu.be and embed", () => {
		expect(classifyMedia("https://www.youtube.com/watch?v=abc")).toBe("youtube");
		expect(classifyMedia("https://youtu.be/abc123")).toBe("youtube");
		expect(classifyMedia("https://www.youtube.com/embed/abc123")).toBe("youtube");
	});

	test("recognizes audio and video files", () => {
		expect(classifyMedia("Attachments/lesson.mp3")).toBe("audio");
		expect(classifyMedia("[[Interview.M4A]]")).toBe("audio");
		expect(classifyMedia("https://example.com/clip.mp4?t=10")).toBe("video");
		expect(classifyMedia("file:///Users/me/movie.mov")).toBe("video");
	});

	test("returns null for unknown links or empty values", () => {
		expect(classifyMedia("")).toBeNull();
		expect(classifyMedia("https://example.com/page")).toBeNull();
		expect(classifyMedia("[[Some note]]")).toBeNull();
	});
});

describe("getVideoId / getMediaId", () => {
	test("extracts ids from all supported YouTube URL forms", () => {
		expect(getVideoId("https://www.youtube.com/watch?v=abcdefghijk&t=5")).toBe(
			"abcdefghijk"
		);
		expect(getVideoId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
		expect(getVideoId("https://www.youtube.com/shorts/abcdefghijk")).toBe(
			"abcdefghijk"
		);
		expect(getVideoId("https://www.youtube.com/embed/abcdefghijk")).toBe(
			"abcdefghijk"
		);
	});

	test("falls back to the raw link for local media", () => {
		expect(getMediaId("Attachments/a.mp3")).toBe("Attachments/a.mp3");
		expect(getMediaId("https://example.com/a.mp3")).toBe(
			"https://example.com/a.mp3"
		);
	});
});

describe("time parameters", () => {
	test("parses plain seconds and h/m/s notation", () => {
		expect(parseTimeParam("90")).toBe(90);
		expect(parseTimeParam("1m30s")).toBe(90);
		expect(parseTimeParam("1h2m3s")).toBe(3723);
		expect(parseTimeParam("nonsense")).toBeNull();
	});

	test("reads t from query and hash, including vault-relative paths", () => {
		expect(getInitSecondsFromLink("clip.mp4?t=12")).toEqual({
			seconds: 12,
			fromLink: true,
		});
		expect(getInitSecondsFromLink("clip.mp4#t=1m30s")).toEqual({
			seconds: 90,
			fromLink: true,
		});
		expect(getInitSecondsFromLink("clip.mp4")).toEqual({
			seconds: null,
			fromLink: false,
		});
	});
});

describe("resolveMediaSource", () => {
	const app = {
		vault: {
			adapter: {
				basePath: "/Users/me/vault",
				getResourcePath: (path) => `app://vault-id/${path}`,
			},
			getAbstractFileByPath: (path) =>
				path === "Attachments/a.mp3" ? { path, extension: "mp3" } : null,
		},
	};

	test("passes through URLs the renderer can load directly", () => {
		expect(resolveMediaSource(app, "https://example.com/a.mp3")).toBe(
			"https://example.com/a.mp3"
		);
		expect(resolveMediaSource(app, "app://vault-id/Att%20B.mp3")).toBe(
			"app://vault-id/Att%20B.mp3"
		);
	});

	test("resolves vault paths and wikilinks", () => {
		expect(resolveMediaSource(app, "Attachments/a.mp3")).toBe(
			"app://vault-id/Attachments/a.mp3"
		);
		expect(resolveMediaSource(app, "[[Attachments/a.mp3]]")).toBe(
			"app://vault-id/Attachments/a.mp3"
		);
		expect(resolveMediaSource(app, "![audio](Attachments/a.mp3)")).toBe(
			"app://vault-id/Attachments/a.mp3"
		);
	});

	test("maps file:// paths inside the vault and preserves outside paths", () => {
		expect(resolveMediaSource(app, "file:///Users/me/vault/Attachments/a.mp3")).toBe(
			"app://vault-id/Attachments/a.mp3"
		);
		expect(resolveMediaSource(app, "file:///tmp/a.mp3")).toBe(
			"file:///tmp/a.mp3"
		);
	});

	test("maps absolute paths outside the vault to file:// URLs", () => {
		expect(resolveMediaSource(app, "/Users/me/Documents/audio.mp3")).toBe(
			"file:///Users/me/Documents/audio.mp3"
		);
		expect(resolveMediaSource(app, "/Users/me/vault/Attachments/a.mp3")).toBe(
			"app://vault-id/Attachments/a.mp3"
		);
	});

	test("returns null when a vault file does not exist", () => {
		expect(resolveMediaSource(app, "Attachments/missing.mp3")).toBeNull();
		expect(resolveMediaSource(app, "")).toBeNull();
	});
});
