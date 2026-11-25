import { useAppContext } from "../app-context";
import { formatTimestamp } from "../main";
import * as React from "react";
import YouTube, { YouTubeEvent, YouTubeProps } from "react-youtube";
import { CSSTransition } from "react-transition-group";
import { createMediaController } from "../media-controller";
import { getVideoId } from "../media-utils";

export const MediaFrame: React.FC<{
	mediaLink: string;
	mediaKind: string;
	ytRef: React.RefObject<YouTube>;
	htmlMediaRef: React.RefObject<HTMLMediaElement>;
	src?: string | null;
	initSeconds: number;
	autoplay?: boolean;
}> = ({
	mediaLink,
	mediaKind,
	ytRef,
	htmlMediaRef,
	src,
	initSeconds,
	autoplay,
}) => {
	const isYouTube = mediaKind === "youtube";
	const videoId = isYouTube ? getVideoId(mediaLink) : null;

	const isAudio = mediaKind === "audio";

	const controller = React.useMemo(
		() => createMediaController(mediaKind, ytRef, htmlMediaRef),
		[mediaKind, ytRef, htmlMediaRef]
	);

	const opts: YouTubeProps["opts"] = {
		playerVars: {
			// this needs to be not undefined to work
			start: initSeconds,
			autoplay: autoplay ? 1 : 0,
		},
	};

	const [maxTime, setMaxTime] = React.useState<number>(0);
	const [currentTimestamp, setCurrentTimestamp] = React.useState<number>(0);

	// Calculate the width of the progress bar as a percentage
	const progressBarWidth =
		maxTime > 0 ? (currentTimestamp / maxTime) * 100 : 0;

	// create a ref to store the setInterval function
	const intervalRef = React.useRef<number | null>(null);

	const [hideProgressBar, setHideProgressBar] = React.useState(true);

	const updateTimestamp = React.useCallback(() => {
		controller?.getCurrentTime().then((time) => {
			setCurrentTimestamp(time);
		});
	}, [controller]);

	const startPolling = React.useCallback(() => {
		if (intervalRef.current) return;
		updateTimestamp();
		intervalRef.current = window.setInterval(updateTimestamp, 1000);
		setHideProgressBar(false);
	}, [updateTimestamp]);

	const stopPolling = React.useCallback(() => {
		if (intervalRef.current) {
			window.clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setHideProgressBar(true);
	}, []);

	const onStateChange: YouTubeProps["onStateChange"] = (
		event: YouTubeEvent<number>
	) => {
		// 1 = playing, 2 = paused, 0 = ended
		if (event.data === 1) {
			startPolling();
		} else if (event.data === 2 || event.data === 0) {
			stopPolling();
		}
	};

	React.useEffect(() => {
		return () => {
			if (intervalRef.current) {
				window.clearInterval(intervalRef.current);
			}
		};
	}, []);

	const context = useAppContext();

	React.useEffect(() => {
		if (context?.showTimestamp) {
			updateTimestamp();
		}
	}, [context?.showTimestamp, updateTimestamp]);

	const onLoadedMetadata = (
		event: React.SyntheticEvent<HTMLMediaElement>
	) => {
		const element = event.currentTarget;
		setMaxTime(Number.isFinite(element.duration) ? element.duration : 0);
		if (initSeconds > 0) element.currentTime = initSeconds;
		if (autoplay) {
			const promise = element.play();
			if (promise && typeof promise.catch === "function") {
				promise.catch(() => undefined);
			}
		}
	};

	const nativeMedia = src ? (
		isAudio ? (
			<audio
				key={src}
				ref={htmlMediaRef as React.RefObject<HTMLAudioElement>}
				className="local-media-player local-audio-player"
				src={src}
				controls
				preload="metadata"
				onLoadedMetadata={onLoadedMetadata}
				onTimeUpdate={(event) =>
					setCurrentTimestamp(event.currentTarget.currentTime)
				}
				onPlay={startPolling}
				onPause={stopPolling}
				onEnded={stopPolling}
			/>
		) : (
			<video
				key={src}
				ref={htmlMediaRef as React.RefObject<HTMLVideoElement>}
				className="local-media-player local-video-player"
				src={src}
				playsInline
				preload="metadata"
				onLoadedMetadata={onLoadedMetadata}
				onTimeUpdate={(event) =>
					setCurrentTimestamp(event.currentTarget.currentTime)
				}
				onPlay={startPolling}
				onPause={stopPolling}
				onEnded={stopPolling}
			/>
		)
	) : null;

	const seekBackRef = React.useRef(null);
	const seekForwardRef = React.useRef(null);
	const playRef = React.useRef(null);
	const pauseRef = React.useRef(null);
	const speedRef = React.useRef(null);

	// Audio uses the browser's native controls, so the custom overlays are
	// only rendered for YouTube videos and local video files.
	const showOverlays = !isAudio;

	return (
		<div className="media-top-container">
			<div className="media-container">
				{isYouTube ? (
					/* @ts-ignore TS2607 */
					<YouTube
						ref={ytRef}
						className="youtube-iframe"
						iframeClassName={`youtube-iframe`}
						videoId={videoId ?? ""}
						opts={opts}
						onStateChange={onStateChange}
						onReady={async (event: YouTubeEvent) => {
							const duration = await event.target.getDuration();
							setMaxTime(duration);
						}}
					/>
				) : (
					nativeMedia
				)}
				{showOverlays && (
					<>
						<CSSTransition
							nodeRef={playRef}
							in={context?.showPlay}
							timeout={15000}
							classNames="playpause-icon"
							mountOnEnter={true}
							unmountOnExit={true}
						>
							<div className="playpause-container">
								<div ref={playRef} className="play-icon">
									<svg
										viewBox="0 0 50 50"
										height="45"
										width="45"
										xmlns="http://www.w3.org/2000/svg"
									>
										<polygon
											fill="white"
											points="15,10 40,25 15,40"
										></polygon>
									</svg>
								</div>
							</div>
						</CSSTransition>
						<CSSTransition
							nodeRef={pauseRef}
							in={context?.showPause}
							timeout={15000}
							classNames="playpause-icon"
							mountOnEnter={true}
							unmountOnExit={true}
						>
							<div className="playpause-container">
								<div ref={pauseRef} className="pause-icon">
									<svg
										viewBox="0 0 50 50"
										height="50"
										width="50"
										xmlns="http://www.w3.org/2000/svg"
									>
										<rect
											fill="white"
											height="30"
											width="7"
											y="10"
											x="14"
										></rect>
										<rect
											fill="white"
											height="30"
											width="7"
											y="10"
											x="29"
										></rect>
									</svg>
								</div>
							</div>
						</CSSTransition>
						<CSSTransition
							nodeRef={seekBackRef}
							in={context?.showSeekBackwards}
							timeout={500}
							classNames="seek-icon"
							mountOnEnter={true}
							unmountOnExit={true}
						>
							<div ref={seekBackRef} className="seek-backwards">
								<div className="round">
									<div id="cta">
										<span className="mn-arrow bounceAlphaBack primera back "></span>
										<span className="mn-arrow bounceAlphaBack segunda back "></span>
										<div className="text">
											{context?.settings?.seekSeconds}s
										</div>
									</div>
								</div>
							</div>
						</CSSTransition>
						<CSSTransition
							nodeRef={seekForwardRef}
							in={context?.showSeekForward}
							timeout={500}
							classNames="seek-icon"
							mountOnEnter={true}
							unmountOnExit={true}
						>
							<div ref={seekForwardRef} className="seek-forwards">
								<div className="round">
									<div id="cta">
										<span className="mn-arrow bounceAlpha segunda next "></span>
										<span className="mn-arrow bounceAlpha primera next "></span>
										<div className="text">
											{context?.settings?.seekSeconds}s
										</div>
									</div>
								</div>
							</div>
						</CSSTransition>
						<CSSTransition
							nodeRef={speedRef}
							in={context?.showSpeed}
							timeout={1000}
							// This class is used for the transition classes (e.g speed-icon-enter)
							classNames="speed-icon"
							mountOnEnter={true}
							unmountOnExit={true}
						>
							<div ref={speedRef} className="speed-icon">
								{context?.currentSpeed}x
							</div>
						</CSSTransition>
						<div
							className={`progress-bar-container ${
								hideProgressBar ||
								!context?.settings?.displayProgressBar
									? "hidden"
									: ""
							}`}
						>
							<div
								className={`timestamp ${
									!(
										context?.settings?.displayTimestamp ||
										context?.showTimestamp
									)
										? "hidden"
										: ""
								}`}
							>
								<div className="timestamp-inner">
									{formatTimestamp(currentTimestamp)}
								</div>
							</div>
							<div
								className={`progress-bar`}
								style={{
									width: `${progressBarWidth}%`,
									backgroundColor:
										context?.settings?.progressBarColor,
								}}
							></div>
						</div>
					</>
				)}
			</div>
		</div>
	);
};
