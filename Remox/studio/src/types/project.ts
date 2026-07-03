export interface ProjectJson {
  title: string;
  fps: number;
  width: number;
  height: number;
  projectDir: string;
  scenes: SceneJson[];
  totalPhases: number;
  approvedPhases: number;
  disk: { total: string; used: string; percent: number };
}

export interface SceneJson {
  id: string;
  durationFrames: number;
  audioPath: string;
  tsxPath: string | null;
  briefPath: string | null;
  phaseCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  sceneStatus: SceneStatus;
  hasTsx: boolean;
  hasAudio: boolean;
  hasWhisper: boolean;
  hasRender: boolean;
}

export type SceneStatus = 'pending' | 'in_review' | 'approved' | 'rendering' | 'done' | 'failed';
export type PhaseStatus = 'pending' | 'approved' | 'rejected';

export interface PhaseRange {
  id: number;
  startFrame: number;
  endFrame: number;
  duration: number;
  status: PhaseStatus;
  notes: string | null;
  reviewedAt: string | null;
  thumbnailPath: string | null;
}

export interface PhaseChecklist {
  avSync: 'pass' | 'warn' | 'fail' | 'unknown';
  textPlacement: 'pass' | 'fail' | 'unknown';
  showDontTell: 'pass' | 'warn' | 'unknown';
  fontSize: 'pass' | 'warn' | 'fail' | 'unknown';
}

export interface PhaseDetail extends PhaseRange {
  sceneId: string;
  checklist: PhaseChecklist | null;
  tsxSource: string;
}

export interface ReviewJson {
  sceneId: string;
  totalPhases: number;
  phases: PhaseReviewEntry[];
  sceneStatus: SceneStatus;
  tsxHash: string;
  lastUpdated: string;
}

export interface PhaseReviewEntry {
  id: number;
  status: PhaseStatus;
  notes: string | null;
  reviewedAt: string | null;
  checklist: PhaseChecklist | null;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperJson {
  words?: WhisperWord[];
  segments?: Array<{
    words?: WhisperWord[];
    text: string;
    start: number;
    end: number;
  }>;
  text?: string;
}

export interface PipelineState {
  running: boolean;
  sceneId: string | null;
  stage: string | null;
  startedAt: string | null;
  jobId: string | null;
  progress: number;
}

export interface WsMessage {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface FileChangeEvent {
  path: string;
  absolutePath: string;
  type: 'tsx' | 'audio' | 'image' | 'brief' | 'review' | 'ontology' | 'whisper' | 'command' | 'other';
  changeType: 'added' | 'changed' | 'unlinked';
  sceneId: string | null;
}

export interface LogLine {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  stage: string | null;
  sceneId: string | null;
}

export interface CommandJson {
  id: string;
  timestamp: string;
  command: string;
  params: Record<string, unknown>;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  result?: string;
}
