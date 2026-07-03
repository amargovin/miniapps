import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import type {
  ProjectJson, SceneJson, PhaseRange, LogLine, FileChangeEvent,
  PipelineState, CommandJson,
} from '../types/project';
import { useFileWatcher } from './useFileWatcher';

interface ProjectState {
  project: ProjectJson | null;
  scenes: SceneJson[];
  loading: boolean;
  error: string | null;
  selectedSceneId: string | null;
  selectedPhaseId: number | null;
  phases: Record<string, PhaseRange[]>;
  pipelineState: PipelineState;
  logs: LogLine[];
  fileChanges: FileChangeEvent[];
  wsConnected: boolean;
  pendingCommand: CommandJson | null;
}

type Action =
  | { type: 'SET_PROJECT'; project: ProjectJson }
  | { type: 'SET_SCENES'; scenes: SceneJson[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'SELECT_SCENE'; sceneId: string }
  | { type: 'SELECT_PHASE'; sceneId: string; phaseId: number }
  | { type: 'SET_PHASES'; sceneId: string; phases: PhaseRange[] }
  | { type: 'UPDATE_PHASE_STATUS'; sceneId: string; phaseId: number; status: string; notes: string | null }
  | { type: 'SET_PIPELINE'; state: PipelineState }
  | { type: 'ADD_LOG'; line: LogLine }
  | { type: 'CLEAR_LOGS' }
  | { type: 'ADD_FILE_CHANGE'; change: FileChangeEvent }
  | { type: 'SET_WS_CONNECTED'; connected: boolean }
  | { type: 'SET_PENDING_COMMAND'; command: CommandJson | null };

function reducer(state: ProjectState, action: Action): ProjectState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.project, loading: false };
    case 'SET_SCENES':
      return { ...state, scenes: action.scenes };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false };
    case 'SELECT_SCENE':
      return { ...state, selectedSceneId: action.sceneId, selectedPhaseId: null };
    case 'SELECT_PHASE':
      return { ...state, selectedSceneId: action.sceneId, selectedPhaseId: action.phaseId };
    case 'SET_PHASES':
      return { ...state, phases: { ...state.phases, [action.sceneId]: action.phases } };
    case 'UPDATE_PHASE_STATUS': {
      const existing = state.phases[action.sceneId] || [];
      const updated = existing.map(p =>
        p.id === action.phaseId
          ? { ...p, status: action.status as PhaseRange['status'], notes: action.notes, reviewedAt: new Date().toISOString() }
          : p,
      );
      const scenes = state.scenes.map(s => {
        if (s.id !== action.sceneId) return s;
        return {
          ...s,
          approvedCount: updated.filter(p => p.status === 'approved').length,
          rejectedCount: updated.filter(p => p.status === 'rejected').length,
          pendingCount: updated.filter(p => p.status === 'pending').length,
        };
      });
      return { ...state, phases: { ...state.phases, [action.sceneId]: updated }, scenes };
    }
    case 'SET_PIPELINE':
      return { ...state, pipelineState: action.state };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs.slice(-999), action.line] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'ADD_FILE_CHANGE':
      return { ...state, fileChanges: [action.change, ...state.fileChanges.slice(0, 49)] };
    case 'SET_WS_CONNECTED':
      return { ...state, wsConnected: action.connected };
    case 'SET_PENDING_COMMAND':
      return { ...state, pendingCommand: action.command };
    default:
      return state;
  }
}

const initialState: ProjectState = {
  project: null,
  scenes: [],
  loading: true,
  error: null,
  selectedSceneId: null,
  selectedPhaseId: null,
  phases: {},
  pipelineState: { running: false, sceneId: null, stage: null, startedAt: null, jobId: null, progress: 0 },
  logs: [],
  fileChanges: [],
  wsConnected: false,
  pendingCommand: null,
};

export function useProject() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const logIdRef = useRef(0);

  // ─── Data Fetching ─────────────────────────────────────────────────────

  const fetchProject = useCallback(async () => {
    try {
      const [projectRes, scenesRes] = await Promise.all([
        fetch('/api/project'),
        fetch('/api/scenes'),
      ]);
      if (!projectRes.ok) throw new Error(`Project load failed: ${projectRes.statusText}`);
      const project = await projectRes.json();
      const scenes = await scenesRes.json();
      dispatch({ type: 'SET_PROJECT', project });
      dispatch({ type: 'SET_SCENES', scenes });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }, []);

  const fetchPhases = useCallback(async (sceneId: string) => {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/phases`);
      if (!res.ok) return;
      const phases = await res.json();
      dispatch({ type: 'SET_PHASES', sceneId, phases });
    } catch (e) {
      console.error('fetchPhases error:', e);
    }
  }, []);

  const fetchScenes = useCallback(async () => {
    try {
      const res = await fetch('/api/scenes');
      if (!res.ok) return;
      const scenes = await res.json();
      dispatch({ type: 'SET_SCENES', scenes });
    } catch { /* ignore */ }
  }, []);

  // Load project on mount
  useEffect(() => { fetchProject(); }, [fetchProject]);

  // Fetch phases when scene is selected and phases not yet loaded
  useEffect(() => {
    if (state.selectedSceneId && !state.phases[state.selectedSceneId]) {
      fetchPhases(state.selectedSceneId);
    }
  }, [state.selectedSceneId, state.phases, fetchPhases]);

  // ─── WebSocket Handlers ───────────────────────────────────────────────

  const pipelineStateRef = useRef(state.pipelineState);
  pipelineStateRef.current = state.pipelineState;

  const wsHandlers = {
    connected: () => dispatch({ type: 'SET_WS_CONNECTED', connected: true }),
    disconnected: () => dispatch({ type: 'SET_WS_CONNECTED', connected: false }),

    'file:changed': (data: Record<string, unknown>) => {
      const change = data as unknown as FileChangeEvent;
      dispatch({ type: 'ADD_FILE_CHANGE', change });

      if (change.type === 'tsx' && change.sceneId) {
        const sceneId = change.sceneId;
        setTimeout(() => fetchPhases(sceneId), 600);
      }
      if (['tsx', 'audio', 'review'].includes(change.type)) {
        setTimeout(fetchScenes, 800);
      }
    },

    'phase:ready': (data: Record<string, unknown>) => {
      const sceneId = data.sceneId as string;
      if (sceneId) fetchPhases(sceneId);
    },

    'pipeline:started': (data: Record<string, unknown>) => {
      dispatch({
        type: 'SET_PIPELINE',
        state: {
          running: true,
          sceneId: data.sceneId as string,
          stage: 'starting',
          startedAt: new Date().toISOString(),
          jobId: data.jobId as string,
          progress: 0,
        },
      });
    },

    'pipeline:log': (data: Record<string, unknown>) => {
      dispatch({
        type: 'ADD_LOG',
        line: {
          id: `log_${++logIdRef.current}`,
          timestamp: new Date().toISOString(),
          level: (data.level as LogLine['level']) || 'info',
          message: String(data.message || ''),
          stage: (data.stage as string) || null,
          sceneId: (data.sceneId as string) || null,
        },
      });
    },

    'pipeline:stage': (data: Record<string, unknown>) => {
      dispatch({
        type: 'SET_PIPELINE',
        state: {
          ...pipelineStateRef.current,
          stage: data.stage as string,
        },
      });
    },

    'render:progress': (data: Record<string, unknown>) => {
      dispatch({
        type: 'SET_PIPELINE',
        state: {
          ...pipelineStateRef.current,
          progress: (data.percent as number) || 0,
        },
      });
    },

    'pipeline:done': (data: Record<string, unknown>) => {
      dispatch({
        type: 'SET_PIPELINE',
        state: { running: false, sceneId: null, stage: null, startedAt: null, jobId: null, progress: 0 },
      });
      dispatch({
        type: 'ADD_LOG',
        line: {
          id: `log_${++logIdRef.current}`,
          timestamp: new Date().toISOString(),
          level: (data.success as boolean) ? 'success' : 'error',
          message: (data.success as boolean)
            ? `Pipeline complete: ${data.sceneId} → ${data.outputPath}`
            : `Pipeline failed: ${data.sceneId}`,
          stage: 'done',
          sceneId: (data.sceneId as string) || null,
        },
      });
      if (data.sceneId) setTimeout(fetchScenes, 500);
    },

    'phase:reviewed': (data: Record<string, unknown>) => {
      const sceneId = data.sceneId as string;
      if (sceneId) {
        fetchPhases(sceneId);
        fetchScenes();
      }
    },

    'command:pending': (data: Record<string, unknown>) => {
      dispatch({ type: 'SET_PENDING_COMMAND', command: data as unknown as CommandJson });
    },

    'command:result': (data: Record<string, unknown>) => {
      const status = data.status as string;
      if (status === 'completed' || status === 'cancelled') {
        dispatch({ type: 'SET_PENDING_COMMAND', command: null });
      }
    },
  };

  useFileWatcher(wsHandlers);

  // ─── Actions ──────────────────────────────────────────────────────────

  const selectScene = useCallback((sceneId: string) => {
    dispatch({ type: 'SELECT_SCENE', sceneId });
  }, []);

  const selectPhase = useCallback((sceneId: string, phaseId: number) => {
    dispatch({ type: 'SELECT_PHASE', sceneId, phaseId });
  }, []);

  const reviewPhase = useCallback(async (
    sceneId: string,
    phaseId: number,
    status: 'approved' | 'rejected',
    notes?: string,
  ) => {
    const res = await fetch(`/api/scenes/${sceneId}/phases/${phaseId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Review failed');
    }
    dispatch({ type: 'UPDATE_PHASE_STATUS', sceneId, phaseId, status, notes: notes || null });
    return res.json();
  }, []);

  const bulkReview = useCallback(async (sceneId: string, action: 'approve-all' | 'reject-all', notes?: string) => {
    const res = await fetch(`/api/scenes/${sceneId}/phases/bulk-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    });
    if (!res.ok) throw new Error('Bulk review failed');
    await fetchPhases(sceneId);
    await fetchScenes();
  }, [fetchPhases, fetchScenes]);

  const runPipeline = useCallback(async (sceneId: string, fromStage?: string) => {
    const res = await fetch(`/api/pipeline/${sceneId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromStage: fromStage || null }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || err.detail || 'Pipeline start failed');
    }
    return res.json();
  }, []);

  const sendCommand = useCallback(async (command: string, params: Record<string, unknown>) => {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, params }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Command failed');
    }
    const cmd = await res.json();
    dispatch({ type: 'SET_PENDING_COMMAND', command: cmd });
    return cmd;
  }, []);

  const clearLogs = useCallback(() => dispatch({ type: 'CLEAR_LOGS' }), []);
  const refreshScenes = useCallback(() => fetchScenes(), [fetchScenes]);

  return {
    ...state,
    selectScene,
    selectPhase,
    reviewPhase,
    bulkReview,
    runPipeline,
    sendCommand,
    clearLogs,
    refreshScenes,
    fetchPhases,
  };
}
