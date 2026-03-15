import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';

const toTime = (seconds) => {
  if (!Number.isFinite(seconds)) return '00:00';
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = String(Math.floor((value % 3600) / 60)).padStart(2, '0');
  const secs = String(value % 60).padStart(2, '0');

  if (hours > 0) return `${hours}:${minutes}:${secs}`;
  return `${minutes}:${secs}`;
};

const buildRangeTrack = (ratio, activeColor, baseColor) => {
  const safeRatio = Math.max(0, Math.min(100, ratio));
  return {
    background: `linear-gradient(90deg, ${activeColor} ${safeRatio}%, ${baseColor} ${safeRatio}%)`,
  };
};

const CustomVideoPlayer = ({ src, title = 'Video', className = '' }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });

  const progressRatio = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  const showVolumeControls = isDesktop || isFullscreen;

  const clearHideControlsTimeout = () => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  };

  const scheduleHideControls = () => {
    clearHideControlsTimeout();
    if (!isPlaying) {
      setAreControlsVisible(true);
      return;
    }

    hideControlsTimeoutRef.current = setTimeout(() => {
      setAreControlsVisible(false);
      hideControlsTimeoutRef.current = null;
    }, 2000);
  };

  const revealControls = () => {
    setAreControlsVisible(true);
    scheduleHideControls();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onLoadedMetadata = () => {
      setDuration(video.duration || 0);
      setCurrentTime(video.currentTime || 0);
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime || 0);
    const onVolumeChange = () => setVolume(video.volume ?? 1);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      clearHideControlsTimeout();
      setAreControlsVisible(true);
      return undefined;
    }

    scheduleHideControls();
    return () => {
      clearHideControlsTimeout();
    };
  }, [isPlaying]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const onViewportChange = (event) => setIsDesktop(event.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener('change', onViewportChange);

    return () => {
      mediaQuery.removeEventListener('change', onViewportChange);
    };
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      const node = containerRef.current;
      setIsFullscreen(Boolean(node && document.fullscreenElement === node));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const containerNode = containerRef.current;
    const videoNode = videoRef.current;
    if (!containerNode || !videoNode) return undefined;

    const preventContextActions = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const preventRightMouseDown = (event) => {
      if (event.button === 2) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const options = { capture: true };

    containerNode.addEventListener('contextmenu', preventContextActions, options);
    videoNode.addEventListener('contextmenu', preventContextActions, options);
    videoNode.addEventListener('mousedown', preventRightMouseDown, options);

    return () => {
      containerNode.removeEventListener('contextmenu', preventContextActions, options);
      videoNode.removeEventListener('contextmenu', preventContextActions, options);
      videoNode.removeEventListener('mousedown', preventRightMouseDown, options);
    };
  }, []);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    clearHideControlsTimeout();
    setAreControlsVisible(true);
  }, [src]);

  useEffect(() => {
    const onWindowKeyDown = (event) => {
      if (event.key !== ' ' && event.code !== 'Space') return;

      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable)
      ) {
        return;
      }

      const containerNode = containerRef.current;
      if (!containerNode) return;

      const isFocusWithinPlayer = Boolean(activeElement && containerNode.contains(activeElement));
      if (!isFocusWithinPlayer) return;

      event.preventDefault();
      togglePlay();
      revealControls();
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', onWindowKeyDown);
      clearHideControlsTimeout();
    };
  }, [isPlaying]);

  const handlePlayerInteraction = () => {
    const containerNode = containerRef.current;
    containerNode?.focus({ preventScroll: true });
    revealControls();
  };

  const handleVideoSurfaceTap = () => {
    const containerNode = containerRef.current;
    containerNode?.focus({ preventScroll: true });

    if (!isDesktop && isPlaying) {
      if (areControlsVisible) {
        clearHideControlsTimeout();
        setAreControlsVisible(false);
      } else {
        revealControls();
      }
      return;
    }

    revealControls();
  };

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
      } else {
        video.pause();
      }
    } catch (_error) {
      setIsPlaying(false);
    }
  };

  const handleSeek = (event) => {
    const video = videoRef.current;
    if (!video || !duration || duration <= 0) return;

    const nextRatio = Number(event.target.value);
    const nextTime = (nextRatio / 100) * duration;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (event) => {
    const video = videoRef.current;
    if (!video) return;

    const nextVolume = Number(event.target.value);
    video.volume = nextVolume;
    if (nextVolume > 0 && video.muted) {
      video.muted = false;
    }
    setVolume(nextVolume);
  };

  const toggleFullscreen = async () => {
    const node = containerRef.current;
    if (!node) return;

    try {
      if (!document.fullscreenElement) {
        await node.requestFullscreen?.();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (_error) {
      // Silently ignore fullscreen restrictions by browser policy.
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-slate-900 ${className}`.trim()}
      tabIndex={0}
      onMouseMove={handlePlayerInteraction}
    >
      <video
        ref={videoRef}
        src={src}
        aria-label={title}
        className="w-full h-full object-contain bg-slate-900"
        style={{ WebkitTouchCallout: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
        preload="metadata"
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        playsInline
        onClick={handleVideoSurfaceTap}
        onTouchStart={handleVideoSurfaceTap}
      />

      <div
        className={`absolute left-3 right-3 bottom-3 z-20 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border border-white/20 bg-gradient-to-br from-slate-900/60 to-slate-700/55 backdrop-blur-md transition-all duration-300 ${
          areControlsVisible || !isPlaying
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={async () => {
            await togglePlay();
            revealControls();
          }}
          className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors"
          aria-label={isPlaying ? 'Pausar video' : 'Reproducir video'}
        >
          {isPlaying ? <Pause size={16} strokeWidth={2.6} /> : <Play size={16} strokeWidth={2.6} />}
        </button>

        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={progressRatio}
          onChange={(event) => {
            handleSeek(event);
            revealControls();
          }}
          style={buildRangeTrack(progressRatio, '#3b82f6', '#374151')}
          className="flex-1 min-w-0 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
          aria-label="Progreso del video"
        />

        <span className="hidden md:block min-w-[96px] text-center text-[11px] font-bold text-gray-300">
          {toTime(currentTime)} / {toTime(duration)}
        </span>

        <div
          className={`items-center gap-1.5 ${showVolumeControls ? 'flex' : 'hidden'}`}
        >
          <span className="text-slate-300 leading-none" aria-hidden="true">
            {volume <= 0.001 ? <VolumeX size={14} strokeWidth={2.6} /> : <Volume2 size={14} strokeWidth={2.6} />}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(event) => {
              handleVolumeChange(event);
              revealControls();
            }}
            style={buildRangeTrack(volume * 100, '#3b82f6', '#374151')}
            className="w-[68px] h-1.5 rounded-full appearance-none cursor-pointer bg-gray-700 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer"
            aria-label="Volumen del video"
          />
        </div>

        <button
          type="button"
          onClick={async () => {
            await toggleFullscreen();
            revealControls();
          }}
          className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors"
          aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? <Minimize2 size={16} strokeWidth={2.6} /> : <Maximize2 size={16} strokeWidth={2.6} />}
        </button>
      </div>
    </div>
  );
};

export default CustomVideoPlayer;