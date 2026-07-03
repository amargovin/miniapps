import { useRef, useEffect } from 'react';

/**
 * Manages audio synchronization with the Remotion Player.
 * Maps player frame position to audio time offset.
 */
export function usePhaseAudio(
  audioSrc: string | null,
  phaseAudioStartSeconds: number,
  playerCurrentFrame: number,
  fps: number,
  isPlaying: boolean,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioSrc || !audioRef.current) return;

    const audio = audioRef.current;
    const targetAudioTime = phaseAudioStartSeconds + (playerCurrentFrame / fps);

    const drift = Math.abs(audio.currentTime - targetAudioTime);
    // Only seek if drift > 150ms to avoid constant thrashing
    if (drift > 0.15) {
      audio.currentTime = targetAudioTime;
    }

    if (isPlaying && audio.paused) {
      audio.play().catch(() => { /* autoplay may be blocked */ });
    }
    if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [playerCurrentFrame, isPlaying, phaseAudioStartSeconds, fps, audioSrc]);

  // Update src when it changes
  useEffect(() => {
    if (!audioSrc || !audioRef.current) return;
    const audio = audioRef.current;
    if (!audio.src.endsWith(audioSrc)) {
      audio.src = audioSrc;
      audio.currentTime = phaseAudioStartSeconds;
    }
  }, [audioSrc, phaseAudioStartSeconds]);

  return audioRef;
}
