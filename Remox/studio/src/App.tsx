import React, { useCallback } from 'react';
import { useProject } from './hooks/useProject';
import SceneList from './components/SceneList';
import CenterPanel from './components/CenterPanel';
import Inspector from './components/Inspector';
import PipelineMonitor from './components/PipelineMonitor';

export default function App() {
  const projectState = useProject();
  const {
    project, scenes, loading, error,
    selectedSceneId, selectedPhaseId,
    phases, pipelineState, logs, fileChanges,
    wsConnected, pendingCommand,
    selectScene, selectPhase, reviewPhase, bulkReview,
    runPipeline, sendCommand, clearLogs, refreshScenes, fetchPhases,
  } = projectState;

  const selectedScene = scenes.find(s => s.id === selectedSceneId) ?? null;
  const selectedPhases = selectedSceneId ? (phases[selectedSceneId] ?? []) : [];
  const selectedPhase = selectedPhases.find(p => p.id === selectedPhaseId) ?? null;

  const handleSelectPhase = useCallback((sceneId: string, phaseId: number) => {
    selectPhase(sceneId, phaseId);
    if (!phases[sceneId]) fetchPhases(sceneId);
  }, [selectPhase, phases, fetchPhases]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1a1a1f] text-gray-400">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-200 mb-2">Remox Studio</div>
          <div className="text-sm">Loading project...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#1a1a1f] text-gray-400">
        <div className="text-center max-w-lg p-6">
          <div className="text-2xl font-bold text-red-400 mb-2">Load Error</div>
          <div className="text-sm text-gray-400 mb-4">{error}</div>
          <div className="text-xs text-gray-500">
            Make sure the Express server is running with the correct --project path.
          </div>
          <button
            onClick={refreshScenes}
            className="mt-4 btn btn-default"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const diskPercent = project?.disk?.percent ?? 0;
  const diskColor = diskPercent > 85 ? 'text-red-400' : diskPercent > 70 ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className="flex flex-col h-screen bg-[#1a1a1f] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#15151a] border-b border-[#2e2e38] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-sm tracking-wide">REMOX STUDIO</span>
          {project && (
            <span className="text-gray-400 text-xs truncate max-w-xs">
              {project.title}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Pending command indicator */}
          {pendingCommand && (
            <div className="flex items-center gap-1.5 text-yellow-400 animate-pulse-blue">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block"></span>
              <span>Waiting for Claude Code: {pendingCommand.command}</span>
            </div>
          )}

          {/* Pipeline indicator */}
          {pipelineState.running && (
            <div className="flex items-center gap-1.5 text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block animate-pulse-blue"></span>
              <span>Pipeline: {pipelineState.sceneId} / {pipelineState.stage}</span>
              {pipelineState.progress > 0 && (
                <span className="text-blue-300">{pipelineState.progress.toFixed(0)}%</span>
              )}
            </div>
          )}

          {/* Disk space */}
          {project?.disk && (
            <span className={`${diskColor} font-mono`}>
              Disk: {project.disk.used}/{project.disk.total} ({diskPercent.toFixed(0)}%)
            </span>
          )}

          {/* WS status */}
          <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}
            title={wsConnected ? 'Live' : 'Disconnected'} />
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Scene List */}
        <aside className="w-60 flex-shrink-0 border-r border-[#2e2e38] overflow-y-auto bg-[#1e1e26]">
          <SceneList
            scenes={scenes}
            phases={phases}
            selectedSceneId={selectedSceneId}
            selectedPhaseId={selectedPhaseId}
            onSelectScene={selectScene}
            onSelectPhase={handleSelectPhase}
            onFetchPhases={fetchPhases}
          />
        </aside>

        {/* Center: Preview / Editor */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <CenterPanel
            project={project}
            selectedScene={selectedScene}
            selectedPhase={selectedPhase}
            phases={selectedPhases}
            onSelectPhase={(phaseId) => selectedSceneId && handleSelectPhase(selectedSceneId, phaseId)}
            onRunPipeline={runPipeline}
          />
        </main>

        {/* Right: Inspector */}
        <aside className="w-80 flex-shrink-0 border-l border-[#2e2e38] overflow-y-auto bg-[#1e1e26]">
          <Inspector
            project={project}
            scene={selectedScene}
            phase={selectedPhase}
            phases={selectedPhases}
            onReviewPhase={reviewPhase}
            onBulkReview={bulkReview}
            onSendCommand={sendCommand}
          />
        </aside>
      </div>

      {/* Bottom: Pipeline Monitor */}
      <div className="flex-shrink-0 border-t border-[#2e2e38]">
        <PipelineMonitor
          pipelineState={pipelineState}
          logs={logs}
          fileChanges={fileChanges}
          onClearLogs={clearLogs}
        />
      </div>
    </div>
  );
}
