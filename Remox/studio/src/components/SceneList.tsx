import React, { useState, useEffect } from 'react';
import type { SceneJson, PhaseRange } from '../types/project';

interface Props {
  scenes: SceneJson[];
  phases: Record<string, PhaseRange[]>;
  selectedSceneId: string | null;
  selectedPhaseId: number | null;
  onSelectScene: (sceneId: string) => void;
  onSelectPhase: (sceneId: string, phaseId: number) => void;
  onFetchPhases: (sceneId: string) => void;
}

const TREATMENT_LABELS: Record<string, string> = {
  'KT-cream': 'KT',
  'KT-navy': 'KN',
  'IMG-focal': 'IF',
  'IMG-full': 'IFL',
  'STAT-cream': 'ST',
  'SPLIT': 'SP',
  'STACK': 'SK',
  'NAVY-SLAM': 'NS',
};

const TREATMENT_BADGE_CLASS: Record<string, string> = {
  'KT-cream': 'badge-kt-cream',
  'KT-navy': 'badge-kt-navy',
  'IMG-focal': 'badge-img-focal',
  'IMG-full': 'badge-img-full',
  'STAT-cream': 'badge-stat-cream',
  'SPLIT': 'badge-split',
  'STACK': 'badge-stack',
  'NAVY-SLAM': 'badge-navy-slam',
};

function SceneDot({ status }: { status: string }) {
  const cls = {
    pending: 'dot-pending',
    in_review: 'dot-in-review',
    approved: 'dot-approved',
    rendering: 'dot-rendering animate-pulse-blue',
    done: 'dot-done',
    failed: 'dot-failed',
  }[status] ?? 'dot-pending';

  return <span className={`status-dot ${cls}`} />;
}

function PhaseStatusIcon({ status }: { status: string }) {
  if (status === 'approved') return <span className="text-green-400 text-xs">✓</span>;
  if (status === 'rejected') return <span className="text-red-400 text-xs">✗</span>;
  if (status === 'pending') return <span className="text-gray-500 text-xs">○</span>;
  return <span className="text-blue-400 text-xs animate-pulse">●</span>;
}

function SceneRow({
  scene,
  phases,
  isSelected,
  selectedPhaseId,
  onSelectScene,
  onSelectPhase,
  onFetchPhases,
}: {
  scene: SceneJson;
  phases: PhaseRange[];
  isSelected: boolean;
  selectedPhaseId: number | null;
  onSelectScene: () => void;
  onSelectPhase: (phaseId: number) => void;
  onFetchPhases: () => void;
}) {
  const [expanded, setExpanded] = useState(isSelected);

  useEffect(() => {
    if (isSelected) setExpanded(true);
  }, [isSelected]);

  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    if (newExpanded && phases.length === 0) {
      onFetchPhases();
    }
    if (!expanded) onSelectScene();
  };

  const durationSecs = (scene.durationFrames / 30).toFixed(1);

  return (
    <div className={`border-b border-[#2a2a35] ${isSelected ? 'bg-[#23232d]' : ''}`}>
      {/* Scene header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#24242e] transition-colors group"
        onClick={handleToggle}
      >
        <span className={`text-gray-500 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <SceneDot status={scene.sceneStatus} />
        <span className="font-mono text-xs font-semibold text-gray-200 flex-1">{scene.id}</span>
        <span className="text-[10px] text-gray-500">{durationSecs}s</span>
      </button>

      {/* Phase summary when collapsed */}
      {!expanded && scene.phaseCount > 0 && (
        <div className="px-3 pb-1.5 flex items-center gap-2 text-[10px] text-gray-500">
          {scene.approvedCount > 0 && <span className="text-green-500">{scene.approvedCount}✓</span>}
          {scene.rejectedCount > 0 && <span className="text-red-500">{scene.rejectedCount}✗</span>}
          {scene.pendingCount > 0 && <span>{scene.pendingCount}○</span>}
          <span>/ {scene.phaseCount} phases</span>
          <span className="ml-auto flex gap-0.5">
            {!scene.hasTsx && <span className="text-yellow-600" title="No TSX">!</span>}
            {!scene.hasAudio && <span className="text-orange-600" title="No audio">♪</span>}
            {scene.hasRender && <span className="text-green-600" title="Rendered">●</span>}
          </span>
        </div>
      )}

      {/* Phase list when expanded */}
      {expanded && (
        <div className="pb-1">
          {phases.length === 0 && scene.phaseCount === 0 && (
            <div className="px-6 py-1 text-[10px] text-gray-600 italic">No phases found</div>
          )}
          {phases.length === 0 && scene.phaseCount > 0 && (
            <div className="px-6 py-1 text-[10px] text-gray-600 italic">Loading phases...</div>
          )}
          {phases.map(phase => {
            const isPhaseSelected = selectedPhaseId === phase.id;
            return (
              <button
                key={phase.id}
                className={`w-full flex items-center gap-1.5 px-6 py-1 text-left hover:bg-[#2a2a38] transition-colors text-xs
                  ${isPhaseSelected ? 'bg-[#2e2e40] border-l-2 border-blue-500' : 'border-l-2 border-transparent'}`}
                onClick={() => onSelectPhase(phase.id)}
              >
                <span className="text-gray-500 text-[10px] w-5 flex-shrink-0">P{phase.id}</span>
                <PhaseStatusIcon status={phase.status} />
                <span className="text-[10px] text-gray-400 ml-auto">
                  {phase.duration > 0 ? `${(phase.duration / 30).toFixed(1)}s` : ''}
                </span>
              </button>
            );
          })}

          {/* Action buttons */}
          <div className="px-3 pt-1.5 pb-1 flex gap-1.5">
            <button
              className="text-[10px] text-blue-400 hover:text-blue-300"
              onClick={onSelectScene}
            >
              Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SceneList({
  scenes,
  phases,
  selectedSceneId,
  selectedPhaseId,
  onSelectScene,
  onSelectPhase,
  onFetchPhases,
}: Props) {
  const totalApproved = scenes.reduce((s, sc) => s + sc.approvedCount, 0);
  const totalPhases = scenes.reduce((s, sc) => s + sc.phaseCount, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="px-3 py-2.5 border-b border-[#2e2e38] bg-[#18181f]">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Scenes</div>
        {totalPhases > 0 && (
          <div className="text-[10px] text-gray-500">
            <span className="text-green-400">{totalApproved}</span>
            <span> / {totalPhases} phases approved</span>
          </div>
        )}
      </div>

      {/* Scene list */}
      <div className="flex-1 overflow-y-auto">
        {scenes.length === 0 && (
          <div className="px-4 py-8 text-center text-gray-600 text-xs">
            No scenes found in project.json
          </div>
        )}
        {scenes.map(scene => (
          <SceneRow
            key={scene.id}
            scene={scene}
            phases={phases[scene.id] ?? []}
            isSelected={selectedSceneId === scene.id}
            selectedPhaseId={selectedSceneId === scene.id ? selectedPhaseId : null}
            onSelectScene={() => onSelectScene(scene.id)}
            onSelectPhase={(phaseId) => onSelectPhase(scene.id, phaseId)}
            onFetchPhases={() => onFetchPhases(scene.id)}
          />
        ))}
      </div>
    </div>
  );
}

export { TREATMENT_BADGE_CLASS, TREATMENT_LABELS };
