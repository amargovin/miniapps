import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Player, type PlayerRef, type CallbackListener } from '@remotion/player';
import type { ProjectJson, SceneJson, PhaseRange } from '../types/project';
import { RemotionSceneWrapper } from './RemotionSceneWrapper';

interface Props {
  project: ProjectJson | null;
  scene: SceneJson | null;
  phase: PhaseRange | null;
  phases: PhaseRange[];
  onSelectPhase: (phaseId: number) => void;
}

/**
 * PhasePreview — Renders the selected scene live using Remotion's <Player>.
 *
 * Architecture:
 * - The Player renders the full scene component (via RemotionSceneWrapper)
 * - When a phase is selected, we seek the Player to phase.startFrame
 * - The Player's native controls are hidden; we provide our own transport bar
 * - Audio is handled by the scene's <Audio> component (staticFile-based) —
 *   no separate audio element needed
 *
 * Frame tracking:
 * - We listen to the Player's `frameupdate` event to update the progress bar
 * - Play/Pause is delegated to the PlayerRef API
 */
export default function PhasePreview({ project, scene, phase, phases, onSelectPhase }: Props) {
  const playerRef = useRef<PlayerRef>(null);
  // Audio handled by Remotion's <Audio> component inside the scene TSX
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerReady, setPlayerReady] = useState(false);

  const fps = project?.fps ?? 30;
  const compositionWidth = project?.width ?? 1920;
  const compositionHeight = project?.height ?? 1080;
  const sceneDuration = scene?.durationFrames ?? 300;

  // When phase changes: seek to phase start and pause
  useEffect(() => {
    if (!playerRef.current || !phase) return;
    const t = setTimeout(() => {
      try {
        playerRef.current?.seekTo(phase.startFrame);
        playerRef.current?.pause();
        setIsPlaying(false);
        setCurrentFrame(phase.startFrame);
        // Audio auto-syncs via Remotion Player
      } catch {
        // Player not ready yet — ignore
      }
    }, 50);
    return () => clearTimeout(t);
  }, [phase?.id, phase?.startFrame, scene?.id, fps]);

  // Attach Player event listeners
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onPlay: CallbackListener<'play'> = () => setIsPlaying(true);
    const onPause: CallbackListener<'pause'> = () => setIsPlaying(false);
    const onEnded: CallbackListener<'ended'> = () => setIsPlaying(false);
    const onFrameUpdate: CallbackListener<'frameupdate'> = ({ detail }) => {
      setCurrentFrame(detail.frame);
    };
    const onError: CallbackListener<'error'> = ({ detail }) => {
      setPlayerError(detail.error?.message ?? 'Player error');
    };

    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('ended', onEnded);
    player.addEventListener('frameupdate', onFrameUpdate);
    player.addEventListener('error', onError);

    return () => {
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('ended', onEnded);
      player.removeEventListener('frameupdate', onFrameUpdate);
      player.removeEventListener('error', onError);
    };
  });

  // Clear error on scene change
  useEffect(() => {
    setPlayerError(null);
    setPlayerReady(true);
  }, [scene?.id]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.pause();
    } else {
      // If we're past phase end, seek back to phase start before playing
      if (phase && currentFrame >= phase.endFrame) {
        playerRef.current.seekTo(phase.startFrame);
      }
      playerRef.current.play();
    }
  }, [isPlaying, phase, currentFrame]);

  const handlePrevPhase = useCallback(() => {
    if (!phase || !phases.length) return;
    const idx = phases.findIndex(p => p.id === phase.id);
    if (idx > 0) onSelectPhase(phases[idx - 1].id);
  }, [phase, phases, onSelectPhase]);

  const handleNextPhase = useCallback(() => {
    if (!phase || !phases.length) return;
    const idx = phases.findIndex(p => p.id === phase.id);
    if (idx < phases.length - 1) onSelectPhase(phases[idx + 1].id);
  }, [phase, phases, onSelectPhase]);

  // Click on the progress bar — seek to that frame within the phase
  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !phase) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const targetFrame = Math.round(phase.startFrame + pct * phase.duration);
    playerRef.current.seekTo(Math.max(phase.startFrame, Math.min(phase.endFrame, targetFrame)));
  }, [phase]);

  // Progress within the current phase (0–1)
  const phaseFrame = phase ? Math.max(0, currentFrame - phase.startFrame) : 0;
  const progressPct = phase && phase.duration > 0
    ? Math.min(100, (phaseFrame / phase.duration) * 100)
    : 0;

  const currentSecs = (phaseFrame / fps).toFixed(1);
  const totalSecs = phase ? (phase.duration / fps).toFixed(1) : '0.0';
  const phaseIdx = phase ? phases.findIndex(p => p.id === phase.id) : -1;

  // ── Empty states ────────────────────────────────────────────────────────────

  if (!scene) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
        <div className="text-4xl mb-3">🎬</div>
        <div>Select a scene from the sidebar</div>
        <div className="text-xs mt-1 text-gray-600">Click a scene or phase to preview</div>
      </div>
    );
  }

  if (!phase) {
    // Scene selected but no phase — show scene overview
    return (
      <div className="flex flex-col h-full p-4">
        <div className="text-sm font-semibold text-gray-200 mb-3">{scene.id}</div>
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
          <div className="bg-[#22222a] rounded p-3">
            <div className="text-gray-500 text-[10px] uppercase mb-1">Duration</div>
            <div className="text-gray-200">{(scene.durationFrames / fps).toFixed(1)}s ({scene.durationFrames}f)</div>
          </div>
          <div className="bg-[#22222a] rounded p-3">
            <div className="text-gray-500 text-[10px] uppercase mb-1">Phases</div>
            <div className="text-gray-200">{scene.phaseCount}</div>
          </div>
          <div className="bg-[#22222a] rounded p-3">
            <div className="text-gray-500 text-[10px] uppercase mb-1">Status</div>
            <div className="text-gray-200 capitalize">{scene.sceneStatus}</div>
          </div>
          <div className="bg-[#22222a] rounded p-3">
            <div className="text-gray-500 text-[10px] uppercase mb-1">Audio</div>
            <div className={scene.hasAudio ? 'text-green-400' : 'text-red-400'}>
              {scene.hasAudio ? 'Available' : 'Missing'}
            </div>
          </div>
        </div>

        {/* Phase quick-select */}
        {phases.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] text-gray-500 uppercase mb-2">Click a phase to preview live</div>
            <div className="flex flex-wrap gap-1.5">
              {phases.map(p => (
                <button
                  key={p.id}
                  onClick={() => onSelectPhase(p.id)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors
                    ${p.status === 'approved' ? 'bg-green-900 text-green-300' :
                      p.status === 'rejected' ? 'bg-red-900 text-red-300' :
                      'bg-[#2a2a35] text-gray-400 hover:bg-[#34343f]'}`}
                >
                  P{p.id}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scene-level live preview hint */}
        <div className="mt-6 text-[10px] text-gray-600">
          Select a phase above to see the live Remotion preview.
        </div>
      </div>
    );
  }

  // ── Phase preview with live Remotion Player ─────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Player area */}
      <div className="flex-1 flex flex-col bg-[#0a0a14] relative overflow-hidden">
        {/* Phase info overlay */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
          <span className="bg-[#0a0a14]/80 text-gray-300 text-xs px-2 py-0.5 rounded font-mono">
            {scene.id} / P{phase.id} of {phases.length}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-mono
            ${phase.status === 'approved' ? 'bg-green-900/50 text-green-300' :
              phase.status === 'rejected' ? 'bg-red-900/50 text-red-300' :
              'bg-[#2a2a35] text-gray-400'}`}>
            {phase.status}
          </span>
          <span className="bg-[#0a0a14]/80 text-blue-400 text-xs px-2 py-0.5 rounded font-mono">
            f{phase.startFrame}–{phase.endFrame}
          </span>
        </div>

        {/* Error banner */}
        {playerError && (
          <div className="absolute top-3 right-3 z-10 bg-red-900/80 text-red-300 text-xs px-3 py-1.5 rounded max-w-sm">
            {playerError}
          </div>
        )}

        {/* Remotion Player */}
        {playerReady && scene.hasTsx ? (
          <div className="flex-1 flex items-center justify-center p-2">
            <Player
              ref={playerRef}
              component={RemotionSceneWrapper}
              inputProps={{ sceneId: scene.id }}
              durationInFrames={sceneDuration}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              fps={fps}
              initialFrame={phase.startFrame}
              // Let Remotion handle audio natively through the scene's <Audio> component
              numberOfSharedAudioTags={5}
              // We provide our own transport controls — hide native ones
              controls={false}
              style={{
                width: '100%',
                aspectRatio: `${compositionWidth} / ${compositionHeight}`,
                maxHeight: '100%',
                objectFit: 'contain',
              }}
              // Stop playback at phase end frame
              moveToBeginningWhenEnded={false}
              spaceKeyToPlayOrPause={false}
            />
          </div>
        ) : !scene.hasTsx ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="text-gray-500 text-sm mb-2">No TSX source available for {scene.id}</div>
              <div className="text-gray-600 text-xs">Run the pipeline to generate scene code first.</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-gray-600 text-xs animate-pulse">Initializing player...</div>
          </div>
        )}
      </div>

      {/* Transport controls */}
      <div className="bg-[#1e1e26] border-t border-[#2e2e38] px-4 py-2.5 flex items-center gap-3 shrink-0">
        {/* Phase navigation */}
        <button
          onClick={handlePrevPhase}
          disabled={phaseIdx <= 0}
          className="btn btn-default text-xs px-2 py-1 disabled:opacity-30"
          title="Previous phase (J)"
        >
          Prev
        </button>

        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          className="btn btn-default text-xs px-3 py-1 min-w-[62px]"
          title="Play/Pause (Space)"
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* Next phase */}
        <button
          onClick={handleNextPhase}
          disabled={phaseIdx >= phases.length - 1}
          className="btn btn-default text-xs px-2 py-1 disabled:opacity-30"
          title="Next phase (K)"
        >
          Next
        </button>

        {/* Progress bar — clickable */}
        <div
          className="flex-1 mx-2 cursor-pointer group"
          onClick={handleProgressClick}
          title="Click to seek"
        >
          <div className="relative h-2 bg-[#2e2e38] rounded-full overflow-hidden group-hover:h-3 transition-all">
            {/* Phase progress fill */}
            <div
              className="h-full bg-blue-500 transition-all duration-75"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Time display */}
        <span className="font-mono text-xs text-gray-400 tabular-nums shrink-0">
          {currentSecs}s / {totalSecs}s
        </span>

        {/* Absolute frame display */}
        <span className="font-mono text-[10px] text-gray-600 tabular-nums shrink-0">
          f{currentFrame}
        </span>
      </div>

      {/* Audio handled by Remotion's <Audio> inside the scene component */}
    </div>
  );
}
