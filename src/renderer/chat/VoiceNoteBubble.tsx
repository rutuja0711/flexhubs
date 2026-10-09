import { useEffect, useRef, useState } from 'react';
import { applyAudioElementSink, subscribeAudioOutputChanges } from '../audioOutputDevice';
import { FiPause, FiPlay } from 'react-icons/fi';

type VoiceNoteBubbleProps = {
  src: string;
  isOwn?: boolean;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function VoiceNoteBubble({ src, isOwn = false }: VoiceNoteBubbleProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      void applyAudioElementSink(audio);
    }

    return subscribeAudioOutputChanges(() => {
      const current = audioRef.current;
      if (current) {
        void applyAudioElementSink(current);
      }
    });
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className={`flex min-w-[240px] max-w-[min(100%,280px)] items-center gap-3 rounded-[18px] px-3 py-2.5 shadow-sm ${
        isOwn
          ? 'bg-gradient-to-br from-accent via-accent to-[#632a38] text-white shadow-accent/20'
          : 'bg-app-surface ring-1 ring-app-border/70 text-app-text'
      }`}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
        }}
        onTimeUpdate={(event) => {
          setCurrentTime(event.currentTarget.currentTime);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />
      <button
        type="button"
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
          isOwn
            ? 'bg-white/25 text-white hover:bg-white/35'
            : 'bg-accent/12 text-accent hover:bg-accent/20'
        }`}
        onClick={() => {
          void togglePlay();
        }}
      >
        {playing ? <FiPause className="text-lg" /> : <FiPlay className="ml-0.5 text-lg" />}
      </button>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div
          className={`relative h-1.5 overflow-hidden rounded-full ${
            isOwn ? 'bg-white/20' : 'bg-app-border/80'
          }`}
        >
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-100 ${
              isOwn ? 'bg-white' : 'bg-accent'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div
          className={`flex items-center justify-between text-[11px] tabular-nums ${
            isOwn ? 'text-white/75' : 'text-app-muted'
          }`}
        >
          <span>Voice message</span>
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
