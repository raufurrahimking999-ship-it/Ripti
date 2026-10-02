import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Repeat, Music2, Edit3, X, Check, RotateCcw } from 'lucide-react';
import { RELATIONSHIP_CONFIG, YOUTUBE_SONG_URL } from '../config';
import { humnavaSynth } from '../utils/audioSynth';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
            onError?: (event: { data: number; target?: YTPlayerInstance }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  setVolume: (volume: number) => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  mute: () => void;
  unMute: () => void;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  getPlayerState: () => number;
  destroy: () => void;
}

const STORAGE_KEYS = {
  SONG_URL: 'rls_persisted_song_url',
  SONG_NAME: 'rls_persisted_song_name',
};

interface SongConfig {
  url: string;
  name: string;
  isCustom: boolean;
}

function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  return match ? match[1] : null;
}

/**
 * Synchronous lazy state initialization:
 * Reads saved custom song immediately from localStorage so default song NEVER flashes or overrides.
 */
function getInitialSongConfig(): SongConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedUrl = localStorage.getItem(STORAGE_KEYS.SONG_URL);
      const savedName = localStorage.getItem(STORAGE_KEYS.SONG_NAME);
      if (savedUrl && savedUrl.trim()) {
        return {
          url: savedUrl.trim(),
          name: savedName && savedName.trim() ? savedName.trim() : 'Custom Song',
          isCustom: true,
        };
      }
    }
  } catch (e) {
    console.warn('LocalStorage error reading song config:', e);
  }

  // Default is native local audio
  return {
    url: RELATIONSHIP_CONFIG.audioPath,
    name: RELATIONSHIP_CONFIG.songName,
    isCustom: false,
  };
}

export const MusicPlayerCard: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isUsingSynthRef = useRef<boolean>(false);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);

  // Persistent Song Configuration (Initializes synchronously from storage)
  const [songConfig, setSongConfig] = useState<SongConfig>(getInitialSongConfig);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(49.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(true);
  const [isYtReady, setIsYtReady] = useState<boolean>(false);

  const wasPlayingBeforeSeekRef = useRef<boolean>(false);
  const isSeekingRef = useRef<boolean>(false);

  // Edit Song Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editUrlInput, setEditUrlInput] = useState<string>('');
  const [editNameInput, setEditNameInput] = useState<string>('');

  // Immediate, Fast-Response Startup Volume Fade-in Controller (1.8 seconds)
  const FADE_IN_DURATION_MS = 1800;
  const fadeInRafRef = useRef<number | null>(null);
  const hasFadedInForCurrentSongRef = useRef<boolean>(false);

  const cancelVolumeFade = useCallback(() => {
    if (fadeInRafRef.current !== null) {
      cancelAnimationFrame(fadeInRafRef.current);
      fadeInRafRef.current = null;
    }
  }, []);

  const triggerStartupFadeIn = useCallback(() => {
    if (isMuted) return;
    cancelVolumeFade();

    const audio = audioRef.current;
    const yt = ytPlayerRef.current;

    const startVol = 0.02; // Very soft initial sound
    const targetVol = 1.0; // 100% of phone system media volume

    if (audio) {
      audio.volume = startVol;
    }
    if (yt && isYtReady) {
      try {
        yt.setVolume(startVol * 100);
      } catch {}
    }

    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / FADE_IN_DURATION_MS);

      // Smoothstep curve: natural, immediate bloom
      const smoothProgress = progress * progress * (3 - 2 * progress);
      const currentVol = startVol + (targetVol - startVol) * smoothProgress;

      if (audioRef.current && !isMuted) {
        audioRef.current.volume = Math.min(1, Math.max(0, currentVol));
      }
      if (ytPlayerRef.current && isYtReady && !isMuted) {
        try {
          ytPlayerRef.current.setVolume(Math.min(100, Math.max(0, currentVol * 100)));
        } catch {}
      }

      if (progress < 1) {
        fadeInRafRef.current = requestAnimationFrame(step);
      } else {
        // Fade-in complete: restore full 1.0 so phone's system media volume is 100% in control
        if (audioRef.current && !isMuted) {
          audioRef.current.volume = 1.0;
        }
        if (ytPlayerRef.current && isYtReady && !isMuted) {
          try {
            ytPlayerRef.current.setVolume(100);
          } catch {}
        }
        fadeInRafRef.current = null;
        hasFadedInForCurrentSongRef.current = true;
      }
    };

    fadeInRafRef.current = requestAnimationFrame(step);
  }, [cancelVolumeFade, isMuted, isYtReady]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      cancelVolumeFade();
    };
  }, [cancelVolumeFade]);

  // Sync ref with state for event listeners & rAF
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Determine active media engine
  const youtubeVideoId = extractYouTubeId(songConfig.url);
  const isYouTubeActive = Boolean(youtubeVideoId);
  const directAudioSrc = !isYouTubeActive ? songConfig.url : '';

  // Helper to completely stop all existing audio instances
  const stopAllAudioInstances = useCallback(() => {
    cancelVolumeFade();
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.stopVideo();
        ytPlayerRef.current.pauseVideo();
      } catch {}
    }
    if (isUsingSynthRef.current) {
      humnavaSynth.stop();
      isUsingSynthRef.current = false;
    }
    setIsPlaying(false);
  }, [cancelVolumeFade]);

  // =========================================================================
  // 1. YouTube Iframe Player in background (ONLY when active song is a YouTube link)
  // =========================================================================
  useEffect(() => {
    if (!isYouTubeActive || !youtubeVideoId) {
      setIsYtReady(false);
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.stopVideo();
          ytPlayerRef.current.destroy();
        } catch {}
        ytPlayerRef.current = null;
      }
      return;
    }

    let isMounted = true;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || !ytContainerRef.current) return;
      try {
        ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
          videoId: youtubeVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          },
          events: {
            onReady: (e) => {
              if (isMounted) {
                setIsYtReady(true);
                e.target.setVolume(isMuted ? 0 : 3);
                if (isMuted) e.target.mute();
                const d = e.target.getDuration();
                if (Number.isFinite(d) && d > 0) {
                  setDuration(d);
                }
                // Autoplay YouTube on ready
                try {
                  e.target.playVideo();
                  setIsPlaying(true);
                  if (!hasFadedInForCurrentSongRef.current) {
                    triggerStartupFadeIn();
                  }
                } catch {}
              }
            },
            onStateChange: (event) => {
              if (!isMounted) return;
              if (event.data === 1) { // PLAYING
                setIsPlaying(true);
                if (!hasFadedInForCurrentSongRef.current) {
                  triggerStartupFadeIn();
                }
              } else if (event.data === 2) { // PAUSED
                setIsPlaying(false);
              } else if (event.data === 0) { // ENDED
                if (isLooping) {
                  event.target.playVideo();
                } else {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }
              }
            },
            onError: () => {
              setIsYtReady(false);
            },
          },
        });
      } catch (err) {
        console.warn('Could not initialize YouTube player:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
        try {
          ytPlayerRef.current.loadVideoById(youtubeVideoId);
          setIsYtReady(true);
        } catch {
          initPlayer();
        }
      } else {
        initPlayer();
      }
    } else {
      const existingScript = document.getElementById('youtube-iframe-api');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        if (isMounted) initPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try {
          ytPlayerRef.current.destroy();
        } catch {}
      }
    };
  }, [isYouTubeActive, youtubeVideoId, isLooping, isMuted, triggerStartupFadeIn]);

  // =========================================================================
  // 2. HTML5 Audio Event Listeners (Single Managed Instance)
  // =========================================================================
  useEffect(() => {
    if (isYouTubeActive) return;

    const audio = audioRef.current;
    if (!audio) return;

    const updateDuration = () => {
      const dur = audio.duration;
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
      }
    };

    const onTimeUpdate = () => {
      if (isDraggingRef.current || isSeekingRef.current) return;
      const cur = audio.currentTime;
      if (Number.isFinite(cur)) {
        setCurrentTime(cur);
      }
      updateDuration();
    };

    const onPlay = () => {
      setIsPlaying(true);
      if (!hasFadedInForCurrentSongRef.current) {
        triggerStartupFadeIn();
      }
    };

    const onPause = () => {
      setIsPlaying(false);
    };

    const onEnded = () => {
      if (isDraggingRef.current) return;
      if (isLooping) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        setCurrentTime(0);
      } else {
        setIsPlaying(false);
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setCurrentTime(audio.duration);
        }
      }
    };

    const onSeeking = () => {
      isSeekingRef.current = true;
    };

    const onSeeked = () => {
      isSeekingRef.current = false;
      if (!isDraggingRef.current && Number.isFinite(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('canplay', updateDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('seeked', onSeeked);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('canplay', updateDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('seeking', onSeeking);
      audio.removeEventListener('seeked', onSeeked);
    };
  }, [isYouTubeActive, isLooping, triggerStartupFadeIn]);

  // =========================================================================
  // 3. Ultra-smooth continuous requestAnimationFrame loop while playing
  // =========================================================================
  useEffect(() => {
    let rafId: number | null = null;

    const tick = () => {
      if (!isDraggingRef.current && !isSeekingRef.current) {
        const audio = audioRef.current;
        if (audio && !audio.paused && !isYouTubeActive) {
          const cur = audio.currentTime;
          const dur = audio.duration;
          if (Number.isFinite(cur)) {
            setCurrentTime(cur);
          }
          if (Number.isFinite(dur) && dur > 0) {
            setDuration(dur);
          }
        } else if (isYouTubeActive && ytPlayerRef.current && isYtReady) {
          try {
            const state = ytPlayerRef.current.getPlayerState?.();
            if (state === 1) { // 1 = YT.PlayerState.PLAYING
              const cur = ytPlayerRef.current.getCurrentTime();
              const dur = ytPlayerRef.current.getDuration();
              if (Number.isFinite(cur)) setCurrentTime(cur);
              if (Number.isFinite(dur) && dur > 0) setDuration(dur);
            }
          } catch {}
        }
      }

      if (isPlayingRef.current) {
        rafId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [isPlaying, isYouTubeActive, isYtReady]);

  // =========================================================================
  // 4. Volume and Mute Synchronization (Respects phone system volume directly)
  // =========================================================================
  useEffect(() => {
    if (fadeInRafRef.current === null) {
      if (audioRef.current && !isYouTubeActive) {
        audioRef.current.volume = isMuted ? 0 : 1.0;
      }
      if (isYouTubeActive && ytPlayerRef.current && isYtReady) {
        try {
          if (isMuted) {
            ytPlayerRef.current.mute();
          } else {
            ytPlayerRef.current.unMute();
            ytPlayerRef.current.setVolume(100);
          }
        } catch {}
      }
    }
  }, [isMuted, isYouTubeActive, isYtReady]);

  // =========================================================================
  // 5. Managed Immediate Startup Playback on Load & Source Change
  // =========================================================================
  useEffect(() => {
    let isDisposed = false;
    let removeInteractionListeners: (() => void) | null = null;

    hasFadedInForCurrentSongRef.current = false;

    const startAudio = async () => {
      if (isDisposed) return;

      if (isYouTubeActive) {
        if (ytPlayerRef.current && isYtReady) {
          try {
            ytPlayerRef.current.setVolume(isMuted ? 0 : 2);
            ytPlayerRef.current.playVideo();
            if (!isDisposed) setIsPlaying(true);
          } catch {}
        }
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      try {
        audio.volume = isMuted ? 0 : 0.02; // Initial soft volume
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          await playPromise;
          if (!isDisposed) {
            setIsPlaying(true);
            triggerStartupFadeIn();
          }
        }
      } catch {
        // Browser/WebView blocked autoplay without gesture -> attach one-time listener
        const handleFirstInteraction = async () => {
          if (isDisposed) return;
          try {
            if (isYouTubeActive && ytPlayerRef.current && isYtReady) {
              ytPlayerRef.current.setVolume(isMuted ? 0 : 2);
              ytPlayerRef.current.playVideo();
              if (!isDisposed) setIsPlaying(true);
            } else if (audioRef.current && audioRef.current.paused) {
              audioRef.current.volume = isMuted ? 0 : 0.02;
              await audioRef.current.play();
              if (!isDisposed) {
                setIsPlaying(true);
                triggerStartupFadeIn();
              }
            }
          } catch {}
          if (removeInteractionListeners) {
            removeInteractionListeners();
          }
        };

        removeInteractionListeners = () => {
          window.removeEventListener('click', handleFirstInteraction);
          window.removeEventListener('touchstart', handleFirstInteraction);
          window.removeEventListener('touchend', handleFirstInteraction);
          window.removeEventListener('pointerdown', handleFirstInteraction);
          window.removeEventListener('keydown', handleFirstInteraction);
        };

        window.addEventListener('click', handleFirstInteraction, { once: true, passive: true });
        window.addEventListener('touchstart', handleFirstInteraction, { once: true, passive: true });
        window.addEventListener('touchend', handleFirstInteraction, { once: true, passive: true });
        window.addEventListener('pointerdown', handleFirstInteraction, { once: true, passive: true });
        window.addEventListener('keydown', handleFirstInteraction, { once: true, passive: true });
      }
    };

    // Attempt playback immediately with no arbitrary delay
    startAudio();

    return () => {
      isDisposed = true;
      if (removeInteractionListeners) {
        removeInteractionListeners();
      }
    };
  }, [songConfig.url, isYouTubeActive, isYtReady, isMuted, triggerStartupFadeIn]);

  // =========================================================================
  // 6. Play / Pause Toggle Handler
  // =========================================================================
  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      stopAllAudioInstances();
    } else {
      let played = false;

      // 1. If YouTube is active, play YouTube
      if (isYouTubeActive && ytPlayerRef.current && isYtReady) {
        try {
          if (hasFadedInForCurrentSongRef.current && !isMuted) {
            try { ytPlayerRef.current.setVolume(100); } catch {}
          }
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          played = true;
        } catch (err) {
          console.warn('YouTube play attempt failed:', err);
        }
      }

      // 2. Try HTML5 native audio (for local bundled or direct audio URL)
      const audio = audioRef.current;
      if (!played && !isYouTubeActive && audio) {
        try {
          if (hasFadedInForCurrentSongRef.current && !isMuted) {
            audio.volume = 1.0;
          }
          await audio.play();
          setIsPlaying(true);
          played = true;
          isUsingSynthRef.current = false;
        } catch (audioErr) {
          console.warn('Native audio play error, trying fallback:', audioErr);
        }
      }

      // 3. Fallback Synthesizer for offline fallback (ONLY for the original default song)
      if (!played && !isYouTubeActive && !songConfig.isCustom) {
        isUsingSynthRef.current = true;
        setIsPlaying(true);
        humnavaSynth.play(
          (time, dur) => {
            if (!isDraggingRef.current) {
              setCurrentTime(time);
              if (Number.isFinite(dur) && dur > 0) setDuration(dur);
            }
          },
          () => {
            if (isLooping) {
              humnavaSynth.play();
            } else {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          }
        );
      }
    }
  }, [isPlaying, isLooping, isYouTubeActive, isYtReady, isMuted, songConfig.isCustom, stopAllAudioInstances]);

  // =========================================================================
  // 7. Song Persistence Handlers (Save / Reset)
  // =========================================================================
  const handleSaveCustomSong = (url: string, name?: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    // Stop all audio cleanly before loading new song
    stopAllAudioInstances();

    let detectedName = name?.trim();
    if (!detectedName) {
      const ytId = extractYouTubeId(trimmedUrl);
      if (ytId) {
        detectedName = 'YouTube Song';
      } else {
        const parts = trimmedUrl.split('/');
        const filename = parts[parts.length - 1]?.split('?')[0];
        detectedName = filename ? decodeURIComponent(filename).replace(/\.[^/.]+$/, '') : 'Custom Song';
      }
    }

    const newConfig: SongConfig = {
      url: trimmedUrl,
      name: detectedName || 'Custom Song',
      isCustom: true,
    };

    try {
      localStorage.setItem(STORAGE_KEYS.SONG_URL, newConfig.url);
      localStorage.setItem(STORAGE_KEYS.SONG_NAME, newConfig.name);
    } catch (e) {
      console.warn('Could not persist song to localStorage:', e);
    }

    hasFadedInForCurrentSongRef.current = false;
    setSongConfig(newConfig);
    setCurrentTime(0);
    setSeekTime(null);
    setIsEditModalOpen(false);
  };

  const handleResetToDefault = () => {
    stopAllAudioInstances();

    try {
      localStorage.removeItem(STORAGE_KEYS.SONG_URL);
      localStorage.removeItem(STORAGE_KEYS.SONG_NAME);
    } catch (e) {
      console.warn('Could not clear song in localStorage:', e);
    }

    const defaultConfig: SongConfig = {
      url: RELATIONSHIP_CONFIG.audioPath,
      name: RELATIONSHIP_CONFIG.songName,
      isCustom: false,
    };

    hasFadedInForCurrentSongRef.current = false;
    setSongConfig(defaultConfig);
    setCurrentTime(0);
    setSeekTime(null);
    setIsEditModalOpen(false);
  };

  const openEditModal = () => {
    setEditUrlInput(songConfig.url === RELATIONSHIP_CONFIG.audioPath ? '' : songConfig.url);
    setEditNameInput(songConfig.name === RELATIONSHIP_CONFIG.songName ? '' : songConfig.name);
    setIsEditModalOpen(true);
  };

  // =========================================================================
  // 8. Robust Seeking & Progress Handlers
  // =========================================================================
  const applySeek = useCallback((targetSeconds: number) => {
    const audio = audioRef.current;
    const resolvedDur = (audio && !isYouTubeActive && Number.isFinite(audio.duration) && audio.duration > 0)
      ? audio.duration
      : (Number.isFinite(duration) && duration > 0 ? duration : 49.0);

    const safeTarget = Math.max(0, Math.min(targetSeconds, Math.max(0, resolvedDur - 0.1)));

    setCurrentTime(safeTarget);
    setSeekTime(null);
    isDraggingRef.current = false;

    if (!isYouTubeActive && audio && Number.isFinite(safeTarget)) {
      try {
        audio.currentTime = safeTarget;
      } catch (err) {
        console.warn('HTML5 audio seek error:', err);
      }

      if (wasPlayingBeforeSeekRef.current && audio.paused) {
        audio.play().catch(() => {});
      }
    }

    if (isYouTubeActive && ytPlayerRef.current && isYtReady) {
      try {
        ytPlayerRef.current.seekTo(safeTarget, true);
        if (wasPlayingBeforeSeekRef.current) {
          ytPlayerRef.current.playVideo();
        }
      } catch {}
    }
  }, [duration, isYouTubeActive, isYtReady]);

  const handlePointerDown = () => {
    isDraggingRef.current = true;
    wasPlayingBeforeSeekRef.current = isPlayingRef.current;
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!Number.isFinite(val)) return;

    if (isDraggingRef.current) {
      setSeekTime(val);
    } else {
      applySeek(val);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLInputElement>) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    applySeek(Number.isFinite(val) ? val : (seekTime ?? currentTime));
  };

  const handlePointerCancel = () => {
    if (seekTime !== null) {
      applySeek(seekTime);
    } else {
      isDraggingRef.current = false;
      setSeekTime(null);
    }
  };

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const toggleLoop = () => {
    setIsLooping((prev) => {
      const next = !prev;
      if (audioRef.current && !isYouTubeActive) {
        audioRef.current.loop = next;
      }
      return next;
    });
  };

  const formatAudioTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0 || !Number.isFinite(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const validDuration = Number.isFinite(duration) && duration > 0 ? duration : 49.0;
  const currentDisplayTime = seekTime !== null ? seekTime : currentTime;
  const validDisplayTime = Number.isFinite(currentDisplayTime)
    ? Math.max(0, Math.min(currentDisplayTime, validDuration))
    : 0;
  const progressPercent = validDuration > 0
    ? Math.min(100, Math.max(0, (validDisplayTime / validDuration) * 100))
    : 0;

  return (
    <div className="w-full max-w-md px-2 relative">
      {/* Hidden YouTube player container (Rendered ONLY when song is YouTube link) */}
      {isYouTubeActive && (
        <div
          ref={ytContainerRef}
          className="absolute -left-[9999px] top-0 w-1 h-1 opacity-0 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Hidden Single Native Audio Element (Rendered ONLY when song is local or direct audio) */}
      {!isYouTubeActive && (
        <audio
          ref={audioRef}
          src={directAudioSrc}
          loop={isLooping}
          preload="auto"
        >
          <source src={directAudioSrc} type="audio/mpeg" />
          {!songConfig.isCustom && (
            <source src={RELATIONSHIP_CONFIG.audioFallbackPath} type="audio/wav" />
          )}
        </audio>
      )}

      {/* Compact Glassmorphic Music Card */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-4 transition-all duration-300 relative overflow-hidden">
        {/* Subtle Ambient Backlight Glow inside Card while playing */}
        <div
          className={`absolute -top-12 -right-12 w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500/15 via-violet-600/10 to-indigo-400/10 blur-xl transition-opacity duration-1000 pointer-events-none ${
            isPlaying ? 'opacity-100 animate-pulse-glow' : 'opacity-0'
          }`}
        />

        {/* Top Header Row: Icon, Title & Controls */}
        <div className="flex items-center justify-between gap-2.5">
          {/* Left: Disc icon & Song meta */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Compact Spinning Disc Icon */}
            <div
              className={`relative w-8 h-8 rounded-full bg-slate-900/70 border border-white/[0.12] flex items-center justify-center shrink-0 shadow-inner transition-all duration-700 ${
                isPlaying
                  ? 'ring-1.5 ring-indigo-400/60 shadow-[0_0_14px_rgba(129,140,248,0.35)] animate-disc-glow'
                  : 'ring-1 ring-white/[0.08] shadow-none'
              }`}
            >
              <div
                className={`w-full h-full flex items-center justify-center transition-transform duration-700 ${
                  isPlaying ? 'animate-[spin_10s_linear_infinite]' : ''
                }`}
              >
                <Music2 className="w-3.5 h-3.5 text-indigo-200/90" />
              </div>
            </div>

            {/* Song Meta (Title + subtle edit link button) */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 group/edit">
                <h2 className="text-xs sm:text-sm font-medium text-slate-100 truncate tracking-wide leading-tight">
                  {songConfig.name}
                </h2>
                <button
                  onClick={openEditModal}
                  className="opacity-40 hover:opacity-100 p-0.5 text-slate-300 hover:text-indigo-300 transition-opacity active:scale-95"
                  title="Change song link"
                  aria-label="Change song URL"
                >
                  <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Mini Equalizer & Compact Play/Pause */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mini Equalizer Frequency Wave Bars */}
            <div
              className="flex items-end gap-0.5 h-4 px-1.5 py-0.5 rounded bg-black/25 shrink-0"
              title={isPlaying ? 'Playing' : 'Paused'}
            >
              {[0.35, 0.9, 0.6, 0.4].map((heightRatio, idx) => (
                <span
                  key={idx}
                  className="w-0.5 bg-gradient-to-t from-indigo-500 via-indigo-400 to-indigo-200 rounded-full transition-all duration-300"
                  style={{
                    height: isPlaying ? `${Math.max(25, heightRatio * 100)}%` : '25%',
                    animation: isPlaying
                      ? `equalizerWave ${0.8 + idx * 0.15}s ease-in-out infinite alternate`
                      : 'none',
                  }}
                />
              ))}
            </div>

            {/* Compact Play / Pause Button */}
            <button
              onClick={togglePlay}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-b from-indigo-500/30 to-violet-600/30 hover:from-indigo-500/40 hover:to-violet-600/40 border border-indigo-400/40 flex items-center justify-center text-white shadow-[0_0_12px_rgba(99,102,241,0.25)] active:scale-95 transition-all duration-150"
              aria-label={isPlaying ? 'Pause song' : 'Play song'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current text-slate-100" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current text-slate-100 ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Slim, Elegant Progress Bar & Timestamps */}
        <div className="mt-2.5 space-y-1">
          {/* Synchronized Custom Progress Track */}
          <div className="relative w-full h-3 sm:h-3.5 flex items-center select-none group">
            {/* Background track line */}
            <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-300 to-violet-400 will-change-[width]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Round Progress Indicator Knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-100 shadow-[0_0_8px_rgba(167,139,250,0.85)] border border-indigo-200 pointer-events-none transition-transform group-hover:scale-110 will-change-[left]"
              style={{ left: `${progressPercent}%` }}
              aria-hidden="true"
            />

            {/* Interactive touch/seek slider covering the exact same track */}
            <input
              type="range"
              min={0}
              max={validDuration}
              step={0.1}
              value={validDisplayTime}
              onPointerDown={handlePointerDown}
              onChange={handleRangeChange}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              aria-label="Seek progress"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
            />
          </div>

          {/* Timestamp Indicators & Controls */}
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono tabular-nums px-0.5 pt-0.5 select-none">
            <span>{formatAudioTime(validDisplayTime)}</span>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleMute}
                className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 active:scale-95"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <VolumeX className="w-3 h-3 text-slate-400" />
                ) : (
                  <Volume2 className="w-3 h-3 text-indigo-300/80" />
                )}
              </button>
              <button
                onClick={toggleLoop}
                className={`p-0.5 transition-colors active:scale-95 ${
                  isLooping ? 'text-indigo-300' : 'text-slate-500 hover:text-slate-300'
                }`}
                aria-label="Toggle repeat"
                title={isLooping ? 'Repeat: On' : 'Repeat: Off'}
              >
                <Repeat className="w-3 h-3" />
              </button>
            </div>

            <span>{formatAudioTime(validDuration)}</span>
          </div>
        </div>
      </div>

      {/* Elegant Song Edit / Add Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-digit-fade"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            className="glass-panel w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-white/10 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Music2 className="w-4 h-4 text-indigo-300" />
                <h3 className="text-sm font-medium text-slate-100 tracking-wide">
                  Change Song Link
                </h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editUrlInput.trim()) {
                  handleSaveCustomSong(editUrlInput, editNameInput);
                }
              }}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="block text-[11px] font-mono uppercase text-indigo-200/70 mb-1">
                  Song URL (YouTube or Direct Audio)
                </label>
                <input
                  type="url"
                  value={editUrlInput}
                  onChange={(e) => setEditUrlInput(e.target.value)}
                  placeholder="https://youtu.be/... or .mp3 link"
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400/80 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-indigo-200/70 mb-1">
                  Song Title (Optional)
                </label>
                <input
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  placeholder="e.g. Humnava Mere"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900/80 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-400/80 transition-colors"
                />
              </div>

              {/* Buttons */}
              <div className="mt-5 flex items-center justify-between gap-2 pt-2">
                {songConfig.isCustom && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-rose-300 hover:text-rose-200 rounded-lg hover:bg-rose-500/10 transition-colors"
                    title="Reset to default starting song"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Default</span>
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!editUrlInput.trim()}
                    className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Song</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
