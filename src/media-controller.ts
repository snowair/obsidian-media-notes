import * as React from "react";
import YouTube from "react-youtube";

const YT_PLAYING_STATE = 1;
const HTML_PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

/** The subset of the YouTube iframe API the plugin relies on. */
interface InternalYouTubePlayer {
	getCurrentTime(): Promise<number>;
	seekTo(seconds: number, allowSeekAhead: boolean): void;
	playVideo(): void;
	pauseVideo(): void;
	getPlayerState(): Promise<number>;
	getDuration(): Promise<number>;
	getAvailablePlaybackRates(): Promise<number[]>;
	getPlaybackRate(): Promise<number>;
	setPlaybackRate(rate: number): void;
}

/**
 * One interface for every player backend, so the plugin commands don't need
 * to know whether they're driving an iframe or a native media element.
 */
export interface MediaController {
	getCurrentTime(): Promise<number>;
	seekTo(seconds: number): void;
	play(): void;
	pause(): void;
	isPlaying(): Promise<boolean>;
	getDuration(): Promise<number>;
	getPlaybackRates(): Promise<number[]>;
	getPlaybackRate(): Promise<number>;
	setPlaybackRate(rate: number): void;
}

const getYouTubePlayer = (
	ytRef?: React.RefObject<YouTube>
): InternalYouTubePlayer | null => {
	const internal = ytRef?.current?.getInternalPlayer?.();
	return (internal as unknown as InternalYouTubePlayer) ?? null;
};

const youtubeController = (
	ytRef?: React.RefObject<YouTube>
): MediaController => ({
	getCurrentTime: async () =>
		(await getYouTubePlayer(ytRef)?.getCurrentTime()) ?? 0,
	seekTo: (seconds) => getYouTubePlayer(ytRef)?.seekTo(seconds, true),
	play: () => getYouTubePlayer(ytRef)?.playVideo(),
	pause: () => getYouTubePlayer(ytRef)?.pauseVideo(),
	isPlaying: async () =>
		(await getYouTubePlayer(ytRef)?.getPlayerState()) === YT_PLAYING_STATE,
	getDuration: async () =>
		(await getYouTubePlayer(ytRef)?.getDuration()) ?? 0,
	getPlaybackRates: async () =>
		(await getYouTubePlayer(ytRef)?.getAvailablePlaybackRates()) ?? [1],
	getPlaybackRate: async () =>
		(await getYouTubePlayer(ytRef)?.getPlaybackRate()) ?? 1,
	setPlaybackRate: (rate) =>
		getYouTubePlayer(ytRef)?.setPlaybackRate(rate),
});

const htmlController = (
	mediaRef?: React.RefObject<HTMLMediaElement>
): MediaController => ({
	getCurrentTime: async () => mediaRef?.current?.currentTime ?? 0,
	seekTo: (seconds) => {
		const element = mediaRef?.current;
		if (element) element.currentTime = seconds;
	},
	play: () => {
		const element = mediaRef?.current;
		if (!element) return;
		const promise = element.play();
		if (promise && typeof promise.catch === "function") {
			promise.catch(() => undefined);
		}
	},
	pause: () => mediaRef?.current?.pause(),
	isPlaying: async () => {
		const element = mediaRef?.current;
		return !!element && !element.paused && !element.ended;
	},
	getDuration: async () => {
		const duration = mediaRef?.current?.duration;
		return duration && Number.isFinite(duration) ? duration : 0;
	},
	getPlaybackRates: async () => HTML_PLAYBACK_RATES,
	getPlaybackRate: async () => mediaRef?.current?.playbackRate ?? 1,
	setPlaybackRate: (rate) => {
		if (mediaRef?.current) mediaRef.current.playbackRate = rate;
	},
});

/**
 * Build a controller for a media kind. Refs may still be empty at this point;
 * every method resolves the element lazily when it is called.
 */
export const createMediaController = (
	kind: string,
	ytRef?: React.RefObject<YouTube>,
	htmlMediaRef?: React.RefObject<HTMLMediaElement>
): MediaController | null => {
	if (kind === "youtube") return youtubeController(ytRef);
	if (kind === "video" || kind === "audio") return htmlController(htmlMediaRef);
	return null;
};
