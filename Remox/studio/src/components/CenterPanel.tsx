import React, { useState } from 'react';
import type { ProjectJson, SceneJson, PhaseRange } from '../types/project';
import PhasePreview from './PhasePreview';

interface Props {
  project: ProjectJson | null;
  selectedScene: SceneJson | null;
  selectedPhase: PhaseRange | null;
  phases: PhaseRange[];
  onSelectPhase: (phaseId: number) => void;
  onRunPipeline: (sceneId: string, fromStage?: string) => Promise<unknown>;
}

type CenterMode = 'preview' | 'source';

export default function CenterPanel({
  project,
  selectedScene,
  selectedPhase,
  phases,
  onSelectPhase,
  onRunPipeline,
}: Props) {
  const [mode, setMode] = useState<CenterMode>('preview');
  const [tsxSource, setTsxSource] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const loadSource = () => {
    if (!selectedScene?.id) return;
    fetch(`/api/scenes/${selectedScene.id}/tsx`)
      .then(r => r.ok ? r.text() : null)
      .then(src => { setTsxSource(src); setMode('source'); });
  };

  const handleRender = async () => {
    if (!selectedScene?.id || pipelineRunning) return;
    setPipelineRunning(true);
    setPipelineError(null);
    try {
      await onRunPipeline(selectedScene.id);
    } catch (e) {
      setPipelineError(String(e));
    } finally {
      setPipelineRunning(false);
    }
  };

  const canRender = selectedScene?.approvedCount === selectedScene?.phaseCount && selectedScene?.phaseCount > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[#2e2e38] bg-[#18181f] px-3 py-1.5 gap-1">
        <TabButton label="Preview" active={mode === 'preview'} onClick={() => setMode('preview')} />
        <TabButton
          label="Source"
          active={mode === 'source'}
          onClick={() => { loadSource(); }}
        />
        <div className="flex-1" />

        {/* Render button */}
        {selectedScene && (
          <div className="flex items-center gap-2">
            {pipelineError && (
              <span className="text-red-400 text-xs max-w-xs truncate" title={pipelineError}>
                {pipelineError}
              </span>
            )}
            <button
              onClick={handleRender}
              disabled={!canRender || pipelineRunning}
              className={`btn text-xs px-3 ${canRender && !pipelineRunning ? 'btn-primary' : 'btn-default opacity-50'}`}
              title={canRender ? 'Render scene (all phases approved)' : 'Approve all phases to enable render'}
            >
              {pipelineRunning ? 'Starting...' : selectedScene.hasRender ? 'Re-render' : 'Render Scene'}
            </button>

            {/* Quick pipeline stages */}
            {selectedScene.hasTsx && (
              <div className="flex gap-1">
                <button
                  onClick={() => onRunPipeline(selectedScene.id, 'audit')}
                  className="btn btn-default text-[10px] px-2 py-1"
                  title="Run audit check"
                >
                  Audit
                </button>
                <button
                  onClick={() => onRunPipeline(selectedScene.id, 'validate')}
                  className="btn btn-default text-[10px] px-2 py-1"
                  title="Run validation (render frame 0)"
                >
                  Validate
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        {mode === 'preview' && (
          <PhasePreview
            project={project}
            scene={selectedScene}
            phase={selectedPhase}
            phases={phases}
            onSelectPhase={onSelectPhase}
          />
        )}
        {mode === 'source' && (
          <SourceView
            sceneId={selectedScene?.id ?? null}
            source={tsxSource}
            selectedPhaseId={selectedPhase?.id ?? null}
            phases={phases}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded transition-colors ${
        active
          ? 'bg-[#2a2a38] text-gray-200'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  );
}

function SourceView({
  sceneId,
  source,
  selectedPhaseId,
  phases,
}: {
  sceneId: string | null;
  source: string | null;
  selectedPhaseId: number | null;
  phases: PhaseRange[];
}) {
  if (!sceneId) return <div className="p-4 text-gray-600 text-xs">No scene selected</div>;
  if (!source) return <div className="p-4 text-gray-600 text-xs">No TSX source available</div>;

  // Highlight the selected phase block
  const phaseStart = selectedPhaseId ? source.indexOf(`const Phase${selectedPhaseId}:`) : -1;
  const phaseEnd = selectedPhaseId && phaseStart !== -1
    ? (source.indexOf(`const Phase${selectedPhaseId + 1}:`, phaseStart + 1) > 0
      ? source.indexOf(`const Phase${selectedPhaseId + 1}:`, phaseStart + 1)
      : source.length)
    : -1;

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-1.5 bg-[#18181f] border-b border-[#2e2e38] flex items-center gap-2">
        <span className="text-[10px] text-gray-500 font-mono">{sceneId}.tsx</span>
        {selectedPhaseId && (
          <span className="text-[10px] text-blue-400">
            Phase {selectedPhaseId} highlighted
          </span>
        )}
        <span className="text-[10px] text-gray-600 ml-auto">
          {source.split('\n').length} lines
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <pre className="text-[11px] text-gray-300 font-mono leading-relaxed whitespace-pre">
          {phaseStart !== -1 ? (
            <>
              <span className="text-gray-600">{source.slice(0, phaseStart)}</span>
              <span className="bg-blue-950/30 border-l-2 border-blue-500 pl-1">
                {source.slice(phaseStart, phaseEnd)}
              </span>
              <span className="text-gray-600">{source.slice(phaseEnd)}</span>
            </>
          ) : source}
        </pre>
      </div>
    </div>
  );
}
