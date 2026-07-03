/**
 * Remox Studio — Express Backend Server
 * Runs at localhost:3847
 * Serves REST API + WebSocket for the Vite frontend
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// ─── Config ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3847;
const SKILL_DIR = __dirname;
const REMOTION_SKILL_DIR = path.join(SKILL_DIR, '..', 'remotion');

// Parse --project flag from argv
function getProjectDir(): string {
  const projectArg = process.argv.find(a => a.startsWith('--project='));
  if (projectArg) return path.resolve(projectArg.split('=')[1]);
  const projectIdx = process.argv.indexOf('--project');
  if (projectIdx !== -1 && process.argv[projectIdx + 1]) {
    return path.resolve(process.argv[projectIdx + 1]);
  }
  return process.env.PROJECT_DIR || process.cwd();
}

const PROJECT_DIR = getProjectDir();

// ─── State ────────────────────────────────────────────────────────────────

interface PipelineState {
  running: boolean;
  sceneId: string | null;
  stage: string | null;
  startedAt: string | null;
  jobId: string | null;
  progress: number;
}

let pipelineState: PipelineState = {
  running: false,
  sceneId: null,
  stage: null,
  startedAt: null,
  jobId: null,
  progress: 0,
};

let jobCounter = 0;

// ─── App Setup ───────────────────────────────────────────────────────────

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());

// Serve Vite build (production) or proxy in dev
const distPath = path.join(SKILL_DIR, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// ─── WebSocket Broadcasting ───────────────────────────────────────────────

function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', ws => {
  console.log('[WS] Client connected');
  // Send current state on connect
  ws.send(JSON.stringify({
    event: 'connected',
    data: { projectDir: PROJECT_DIR, pipelineState },
    timestamp: new Date().toISOString(),
  }));
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ─── File Watcher ─────────────────────────────────────────────────────────

function startFileWatcher() {
  const watchPaths = [
    path.join(PROJECT_DIR, 'remotion/src/scenes/**/*.tsx'),
    path.join(PROJECT_DIR, 'audio/**/*.mp3'),
    path.join(PROJECT_DIR, 'audio/**/*_whisper.json'),
    path.join(PROJECT_DIR, 'remotion/public/images/**/*'),
    path.join(PROJECT_DIR, 'briefs/**/*.yml'),
    path.join(PROJECT_DIR, 'review/**/*.json'),
    path.join(PROJECT_DIR, 'studio/commands.json'),
    path.join(PROJECT_DIR, 'ontology.yml'),
  ];

  const watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  function getFileType(filePath: string): string {
    if (filePath.endsWith('.tsx')) return 'tsx';
    if (filePath.endsWith('.mp3')) return 'audio';
    if (filePath.endsWith('_whisper.json')) return 'whisper';
    if (filePath.match(/\.(png|jpg|jpeg|webp)$/)) return 'image';
    if (filePath.endsWith('.yml') && filePath.includes('briefs')) return 'brief';
    if (filePath.includes('ontology')) return 'ontology';
    if (filePath.includes('review') && filePath.endsWith('.json')) return 'review';
    if (filePath.includes('commands.json')) return 'command';
    return 'other';
  }

  function getSceneId(filePath: string): string | null {
    const match = filePath.match(/Scene[_-]?(\d+)/i);
    if (match) return `Scene${match[1].padStart(2, '0')}`;
    const audioMatch = filePath.match(/scene[_-]?(\d+)/i);
    if (audioMatch) return `Scene${audioMatch[1].padStart(2, '0')}`;
    return null;
  }

  const handleChange = (changeType: string) => (filePath: string) => {
    const relativePath = path.relative(PROJECT_DIR, filePath);
    const fileType = getFileType(filePath);
    const sceneId = getSceneId(filePath);

    broadcast('file:changed', {
      path: relativePath,
      absolutePath: filePath,
      type: fileType,
      changeType,
      sceneId,
    });

    // On TSX change, parse phases and emit phase:ready
    if (fileType === 'tsx' && sceneId && changeType !== 'unlink') {
      setTimeout(() => {
        try {
          const source = fs.readFileSync(filePath, 'utf-8');
          const phases = parsePhaseCountFromSource(source);
          if (phases.length > 0) {
            broadcast('phase:ready', {
              sceneId,
              phaseCount: phases.length,
              phaseDurations: phases,
            });
          }
        } catch {
          // Ignore parse errors
        }
      }, 500);
    }

    // On command.json change, check if it's a result from Claude Code
    if (fileType === 'command') {
      try {
        const cmd = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (cmd.status === 'completed' || cmd.status === 'failed') {
          broadcast('command:result', {
            commandId: cmd.id,
            status: cmd.status,
            result: cmd.result || null,
          });
        }
      } catch {
        // Ignore
      }
    }
  };

  watcher.on('add', handleChange('added'));
  watcher.on('change', handleChange('changed'));
  watcher.on('unlink', handleChange('unlinked'));

  console.log(`[Watcher] Watching project: ${PROJECT_DIR}`);
  return watcher;
}

function parsePhaseCountFromSource(source: string): number[] {
  // Try header comment first
  const headerMatch = source.match(/\/\/ Phase durations: ([\d+]+)/);
  if (headerMatch) {
    return headerMatch[1].split('+').map(Number);
  }
  // Fallback: count Phase components
  const phaseMatches = source.matchAll(/const Phase(\d+)/g);
  const phases: number[] = [];
  for (const m of phaseMatches) {
    phases.push(parseInt(m[1]));
  }
  // Extract durations from TransitionSeries if possible
  const durMatches = [...source.matchAll(/durationInFrames=\{(\d+)\}/g)];
  if (durMatches.length > 0) {
    return durMatches.map(m => parseInt(m[1]));
  }
  return phases.map(() => 0);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function md5File(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(content).digest('hex');
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

interface ProjectJson {
  title: string;
  fps: number;
  width: number;
  height: number;
  scenes: Array<{ id: string; audio: string; durationFrames: number }>;
}

function loadProject(): ProjectJson | null {
  const projectPath = path.join(PROJECT_DIR, 'project.json');
  return readJsonSafe<ProjectJson | null>(projectPath, null);
}

interface ReviewJson {
  sceneId: string;
  totalPhases: number;
  phases: PhaseReview[];
  sceneStatus: string;
  tsxHash: string;
  lastUpdated: string;
}

interface PhaseReview {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  reviewedAt: string | null;
  checklist: { avSync: string; textPlacement: string; showDontTell: string; fontSize: string } | null;
}

function loadReview(sceneId: string): ReviewJson | null {
  const reviewPath = path.join(PROJECT_DIR, 'review', `${sceneId}_review.json`);
  return readJsonSafe<ReviewJson | null>(reviewPath, null);
}

function saveReview(sceneId: string, review: ReviewJson) {
  ensureDir(path.join(PROJECT_DIR, 'review'));
  const reviewPath = path.join(PROJECT_DIR, 'review', `${sceneId}_review.json`);
  fs.writeFileSync(reviewPath, JSON.stringify(review, null, 2));
}

function initReview(sceneId: string, phaseCount: number): ReviewJson {
  const tsxPath = path.join(PROJECT_DIR, 'remotion/src/scenes', `${sceneId}.tsx`);
  const tsxHash = fs.existsSync(tsxPath) ? md5File(tsxPath) : '';
  return {
    sceneId,
    totalPhases: phaseCount,
    phases: Array.from({ length: phaseCount }, (_, i) => ({
      id: i + 1,
      status: 'pending',
      notes: null,
      reviewedAt: null,
      checklist: null,
    })),
    sceneStatus: 'pending',
    tsxHash,
    lastUpdated: new Date().toISOString(),
  };
}

function resolveTsxPath(sceneId: string): string | null {
  const p1 = path.join(PROJECT_DIR, 'remotion/src/scenes', `${sceneId}.tsx`);
  if (fs.existsSync(p1)) return p1;
  // Try Scene_01 format (underscore + zero-padded number)
  const num = sceneId.replace(/^Scene0*/, '');
  const p2 = path.join(PROJECT_DIR, 'remotion/src/scenes', `Scene_${num.padStart(2, '0')}.tsx`);
  if (fs.existsSync(p2)) return p2;
  // Try with direct replacement
  const p3 = path.join(PROJECT_DIR, 'remotion/src/scenes', `Scene_${sceneId.replace('Scene', '')}.tsx`);
  if (fs.existsSync(p3)) return p3;
  return null;
}

function getPhaseCount(sceneId: string): number {
  const tsxPath = resolveTsxPath(sceneId);
  if (!tsxPath) return 0;
  const source = fs.readFileSync(tsxPath, 'utf-8');
  const phases = parsePhaseCountFromSource(source);
  return phases.length;
}

function getSceneStatus(review: ReviewJson | null): string {
  if (!review) return 'pending';
  const statuses = review.phases.map(p => p.status);
  if (statuses.every(s => s === 'approved')) return 'approved';
  if (statuses.some(s => s === 'rejected')) return 'in_review';
  if (statuses.some(s => s === 'approved')) return 'in_review';
  return 'pending';
}

// ─── Disk Space ───────────────────────────────────────────────────────────

async function getDiskInfo() {
  return new Promise<{ total: number; used: number; free: number; percent: number }>((resolve) => {
    const proc = spawn('df', ['-k', PROJECT_DIR]);
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.on('close', () => {
      const lines = output.trim().split('\n');
      const parts = lines[1]?.split(/\s+/) || [];
      const total = parseInt(parts[1] || '0') * 1024;
      const used = parseInt(parts[2] || '0') * 1024;
      const free = parseInt(parts[3] || '0') * 1024;
      const percent = total > 0 ? Math.round((used / total) * 100 * 10) / 10 : 0;
      resolve({ total, used, free, percent });
    });
    proc.on('error', () => resolve({ total: 0, used: 0, free: 0, percent: 0 }));
  });
}

// ─── Pre-sync Check ───────────────────────────────────────────────────────

function syncTsxToSkillTemplate(sceneId: string): { success: boolean; message: string; details: string[] } {
  const srcPath = path.join(PROJECT_DIR, 'remotion/src/scenes', `${sceneId}.tsx`);
  const scenesAlt = path.join(PROJECT_DIR, 'remotion/src/scenes', `Scene_${sceneId.replace('Scene', '')}.tsx`);

  const src = fs.existsSync(srcPath) ? srcPath : fs.existsSync(scenesAlt) ? scenesAlt : null;
  if (!src) {
    return { success: false, message: `TSX not found for ${sceneId}`, details: [] };
  }

  const destDir = path.join(REMOTION_SKILL_DIR, 'src/scenes');
  const destFileName = path.basename(src);
  const dest = path.join(destDir, destFileName);

  if (!fs.existsSync(destDir)) {
    return { success: false, message: `Skill template scenes dir not found: ${destDir}`, details: [] };
  }

  const srcHash = md5File(src);
  fs.copyFileSync(src, dest);
  const destHash = md5File(dest);

  const details = [
    `Source: ${src}`,
    `Dest: ${dest}`,
    `Source MD5: ${srcHash}`,
    `Dest MD5: ${destHash}`,
    `Match: ${srcHash === destHash ? 'YES' : 'NO'}`,
  ];

  if (srcHash !== destHash) {
    return { success: false, message: 'MD5 mismatch after sync — aborting', details };
  }
  return { success: true, message: 'Sync OK', details };
}

// ─── Pipeline Runner ──────────────────────────────────────────────────────

function runPipeline(sceneId: string, fromStage: string | null): string {
  const jobId = `job_${String(++jobCounter).padStart(3, '0')}`;
  const pipelineScript = path.join(REMOTION_SKILL_DIR, 'pipeline.mjs');
  const projectJson = path.join(PROJECT_DIR, 'project.json');

  const args = [pipelineScript, projectJson, '--scene', sceneId, '--auto-approve'];
  if (fromStage) args.push('--from', fromStage);

  pipelineState = {
    running: true,
    sceneId,
    stage: fromStage || 'preflight',
    startedAt: new Date().toISOString(),
    jobId,
    progress: 0,
  };

  broadcast('pipeline:started', { sceneId, jobId, fromStage });

  const proc = spawn('node', args, { cwd: PROJECT_DIR });

  const logLine = (level: string, message: string) => {
    // Parse stage from log lines like [AUDIT] or [RENDER]
    const stageMatch = message.match(/\[(\w+)\]/);
    if (stageMatch) {
      pipelineState.stage = stageMatch[1].toLowerCase();
    }

    // Parse render progress
    const progressMatch = message.match(/(\d+(?:\.\d+)?)%/);
    if (progressMatch && pipelineState.stage === 'render') {
      pipelineState.progress = parseFloat(progressMatch[1]);
      const frameMatch = message.match(/frame (\d+)\/(\d+)/i);
      if (frameMatch) {
        broadcast('render:progress', {
          sceneId,
          jobId,
          percent: pipelineState.progress,
          frame: parseInt(frameMatch[1]),
          totalFrames: parseInt(frameMatch[2]),
        });
      }
    }

    broadcast('pipeline:log', {
      sceneId,
      jobId,
      stage: pipelineState.stage,
      level,
      message: message.trim(),
    });
  };

  proc.stdout.on('data', (data: Buffer) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      const level = line.includes('PASS') || line.includes('OK') ? 'success'
        : line.includes('WARN') ? 'warn'
        : line.includes('FAIL') || line.includes('ERROR') ? 'error'
        : 'info';
      logLine(level, line);
    });
  });

  proc.stderr.on('data', (data: Buffer) => {
    data.toString().split('\n').filter(Boolean).forEach(line => {
      logLine('error', line);
    });
  });

  proc.on('close', code => {
    pipelineState = { running: false, sceneId: null, stage: null, startedAt: null, jobId: null, progress: 0 };

    const outputPath = `output/scenes/${sceneId.toLowerCase().replace('scene', 'scene_')}.mp4`;
    const absOutputPath = path.join(PROJECT_DIR, outputPath);
    const success = code === 0;

    broadcast('pipeline:done', {
      sceneId,
      jobId,
      success,
      outputPath: success && fs.existsSync(absOutputPath) ? outputPath : null,
      sizeBytes: success && fs.existsSync(absOutputPath) ? fs.statSync(absOutputPath).size : 0,
      exitCode: code,
    });
  });

  return jobId;
}

// ─── API Routes ───────────────────────────────────────────────────────────

// GET /api/project
app.get('/api/project', async (req, res) => {
  const project = loadProject();
  if (!project) return res.status(404).json({ error: 'project.json not found', detail: `Looking in ${PROJECT_DIR}` });

  let totalPhases = 0;
  let approvedPhases = 0;

  for (const scene of project.scenes) {
    const review = loadReview(scene.id);
    if (review) {
      totalPhases += review.totalPhases;
      approvedPhases += review.phases.filter(p => p.status === 'approved').length;
    } else {
      const count = getPhaseCount(scene.id);
      totalPhases += count;
    }
  }

  const disk = await getDiskInfo();

  res.json({
    ...project,
    projectDir: PROJECT_DIR,
    totalPhases,
    approvedPhases,
    disk: {
      total: `${Math.round(disk.total / 1e9)}GB`,
      used: `${Math.round(disk.used / 1e9)}GB`,
      percent: disk.percent,
    },
  });
});

// GET /api/scenes
app.get('/api/scenes', (req, res) => {
  const project = loadProject();
  if (!project) return res.status(404).json({ error: 'project.json not found' });

  const scenes = project.scenes.map(scene => {
    const resolvedSceneTsx = resolveTsxPath(scene.id);
    const hasTsx = resolvedSceneTsx !== null;

    const audioPath = path.join(PROJECT_DIR, scene.audio);
    const hasAudio = fs.existsSync(audioPath);

    const whisperPath = path.join(PROJECT_DIR, scene.audio.replace('.mp3', '_whisper.json'));
    const hasWhisper = fs.existsSync(whisperPath);

    const outputPath = path.join(PROJECT_DIR, `output/scenes/${scene.id.toLowerCase().replace('scene', 'scene_')}.mp4`);
    const hasRender = fs.existsSync(outputPath);

    const review = loadReview(scene.id);
    const phaseCount = review ? review.totalPhases : getPhaseCount(scene.id);

    return {
      id: scene.id,
      durationFrames: scene.durationFrames,
      audioPath: scene.audio,
      tsxPath: resolvedSceneTsx ? `remotion/src/scenes/${path.basename(resolvedSceneTsx)}` : null,
      briefPath: null,
      phaseCount,
      approvedCount: review ? review.phases.filter(p => p.status === 'approved').length : 0,
      rejectedCount: review ? review.phases.filter(p => p.status === 'rejected').length : 0,
      pendingCount: review ? review.phases.filter(p => p.status === 'pending').length : phaseCount,
      sceneStatus: review ? getSceneStatus(review) : 'pending',
      hasTsx,
      hasAudio,
      hasWhisper,
      hasRender,
    };
  });

  res.json(scenes);
});

// GET /api/scenes/:id
app.get('/api/scenes/:id', (req, res) => {
  const { id } = req.params;
  const project = loadProject();
  if (!project) return res.status(404).json({ error: 'project.json not found' });

  const scene = project.scenes.find(s => s.id === id);
  if (!scene) return res.status(404).json({ error: `Scene ${id} not found` });

  const resolvedTsx = resolveTsxPath(id);

  const tsxSource = resolvedTsx ? fs.readFileSync(resolvedTsx, 'utf-8') : null;
  const review = loadReview(id);
  const phaseCount = tsxSource ? parsePhaseCountFromSource(tsxSource).length : 0;

  // Auto-init review if TSX exists but no review
  const effectiveReview = review || (phaseCount > 0 ? initReview(id, phaseCount) : null);

  res.json({
    ...scene,
    tsxSource,
    review: effectiveReview,
    phaseDurations: tsxSource ? parsePhaseCountFromSource(tsxSource) : [],
  });
});

// GET /api/scenes/:id/phases
app.get('/api/scenes/:id/phases', (req, res) => {
  const { id } = req.params;

  const resolvedTsx = resolveTsxPath(id);

  if (!resolvedTsx) return res.status(404).json({ error: 'TSX not found' });

  const source = fs.readFileSync(resolvedTsx, 'utf-8');
  const durations = parsePhaseCountFromSource(source);
  const review = loadReview(id);

  // Calculate cumulative start frames
  const transitionFrames = 18;
  let startFrame = 0;
  const phases = durations.map((duration, i) => {
    const phaseReview = review?.phases.find(p => p.id === i + 1);
    const result = {
      id: i + 1,
      startFrame,
      endFrame: startFrame + duration - 1,
      duration,
      status: phaseReview?.status || 'pending',
      notes: phaseReview?.notes || null,
      reviewedAt: phaseReview?.reviewedAt || null,
      thumbnailPath: null as string | null,
    };
    startFrame += Math.max(duration - transitionFrames, 1);
    return result;
  });

  res.json(phases);
});

// GET /api/scenes/:id/phases/:pid
app.get('/api/scenes/:id/phases/:pid', (req, res) => {
  const { id, pid } = req.params;
  const phaseId = parseInt(pid);

  const resolvedTsx = resolveTsxPath(id);

  if (!resolvedTsx) return res.status(404).json({ error: 'TSX not found' });

  const source = fs.readFileSync(resolvedTsx, 'utf-8');
  const durations = parsePhaseCountFromSource(source);
  const review = loadReview(id);
  const phaseReview = review?.phases.find(p => p.id === phaseId);

  const transitionFrames = 18;
  let startFrame = 0;
  for (let i = 0; i < phaseId - 1; i++) {
    startFrame += Math.max((durations[i] || 0) - transitionFrames, 1);
  }

  res.json({
    id: phaseId,
    sceneId: id,
    startFrame,
    endFrame: startFrame + (durations[phaseId - 1] || 0) - 1,
    duration: durations[phaseId - 1] || 0,
    status: phaseReview?.status || 'pending',
    notes: phaseReview?.notes || null,
    reviewedAt: phaseReview?.reviewedAt || null,
    checklist: phaseReview?.checklist || null,
    tsxSource: source,
  });
});

// POST /api/scenes/:id/phases/:pid/review
app.post('/api/scenes/:id/phases/:pid/review', (req, res) => {
  const { id, pid } = req.params;
  const phaseId = parseInt(pid);
  const { status, notes, checklist } = req.body as {
    status: 'approved' | 'rejected';
    notes?: string;
    checklist?: PhaseReview['checklist'];
  };

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
  }
  if (status === 'rejected' && !notes?.trim()) {
    return res.status(400).json({ error: 'notes required when rejecting' });
  }

  const resolvedTsx = resolveTsxPath(id);
  const phaseCount = resolvedTsx
    ? parsePhaseCountFromSource(fs.readFileSync(resolvedTsx, 'utf-8')).length
    : 0;

  let review = loadReview(id);
  if (!review) {
    review = initReview(id, phaseCount);
  }

  const phaseIdx = review.phases.findIndex(p => p.id === phaseId);
  if (phaseIdx === -1) {
    // Add missing phase
    review.phases.push({
      id: phaseId,
      status,
      notes: notes || null,
      reviewedAt: new Date().toISOString(),
      checklist: checklist || null,
    });
  } else {
    review.phases[phaseIdx] = {
      ...review.phases[phaseIdx],
      status,
      notes: notes || null,
      reviewedAt: new Date().toISOString(),
      checklist: checklist || review.phases[phaseIdx].checklist,
    };
  }

  review.sceneStatus = getSceneStatus(review);
  review.lastUpdated = new Date().toISOString();
  if (resolvedTsx) review.tsxHash = md5File(resolvedTsx);

  saveReview(id, review);

  broadcast('phase:reviewed', {
    sceneId: id,
    phaseId,
    status,
    hasNotes: !!(notes?.trim()),
  });

  res.json(review.phases.find(p => p.id === phaseId));
});

// POST /api/scenes/:id/phases/bulk-review
app.post('/api/scenes/:id/phases/bulk-review', (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body as { action: 'approve-all' | 'reject-all'; notes?: string };

  const resolvedTsx = resolveTsxPath(id);
  const phaseCount = resolvedTsx
    ? parsePhaseCountFromSource(fs.readFileSync(resolvedTsx, 'utf-8')).length
    : 0;

  let review = loadReview(id) || initReview(id, phaseCount);

  review.phases = review.phases.map(p => ({
    ...p,
    status: action === 'approve-all' ? 'approved' : 'rejected',
    notes: action === 'reject-all' ? (notes || 'Bulk rejected') : p.notes,
    reviewedAt: new Date().toISOString(),
  }));

  review.sceneStatus = getSceneStatus(review);
  review.lastUpdated = new Date().toISOString();
  saveReview(id, review);

  broadcast('phase:reviewed', { sceneId: id, phaseId: 'all', action });
  res.json(review);
});

// GET /api/scenes/:id/audio
app.get('/api/scenes/:id/audio', (req, res) => {
  const { id } = req.params;
  const project = loadProject();
  if (!project) return res.status(404).json({ error: 'project.json not found' });

  const scene = project.scenes.find(s => s.id === id);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const audioPath = path.join(PROJECT_DIR, scene.audio);
  if (!fs.existsSync(audioPath)) return res.status(404).json({ error: 'Audio not found' });

  const stat = fs.statSync(audioPath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0]);
    const end = parts[1] ? parseInt(parts[1]) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': 'audio/mpeg',
    });
    fs.createReadStream(audioPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(audioPath).pipe(res);
  }
});

// GET /api/scenes/:id/whisper
app.get('/api/scenes/:id/whisper', (req, res) => {
  const { id } = req.params;
  const project = loadProject();
  if (!project) return res.status(404).json({ error: 'project.json not found' });

  const scene = project.scenes.find(s => s.id === id);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  const whisperPath = path.join(PROJECT_DIR, scene.audio.replace('.mp3', '_whisper.json'));
  if (!fs.existsSync(whisperPath)) return res.status(404).json({ error: 'Whisper data not found' });

  res.json(readJsonSafe(whisperPath, {}));
});

// GET /api/scenes/:id/tsx
app.get('/api/scenes/:id/tsx', (req, res) => {
  const { id } = req.params;
  const resolvedTsx = resolveTsxPath(id);

  if (!resolvedTsx) return res.status(404).json({ error: 'TSX not found' });
  res.type('text/plain').send(fs.readFileSync(resolvedTsx, 'utf-8'));
});

// ─── Command Endpoints ────────────────────────────────────────────────────

const VALID_COMMANDS = ['generate_audio', 'fix_phase', 'fix_scene', 'regenerate_brief',
  'generate_images', 'run_whisper', 'export_ontology', 'export_briefs'];

app.post('/api/command', (req, res) => {
  const { command, params } = req.body as { command: string; params: unknown };

  if (!VALID_COMMANDS.includes(command)) {
    return res.status(400).json({ error: `Unknown command: ${command}` });
  }

  const commandsPath = path.join(PROJECT_DIR, 'studio/commands.json');
  ensureDir(path.join(PROJECT_DIR, 'studio'));

  // Check if a command is already pending
  if (fs.existsSync(commandsPath)) {
    const existing = readJsonSafe<{ status?: string }>(commandsPath, {});
    if (existing.status === 'pending') {
      return res.status(409).json({ error: 'A command is already pending. Wait for Claude Code to complete it.' });
    }
  }

  const cmd = {
    id: `cmd_${Date.now()}`,
    timestamp: new Date().toISOString(),
    command,
    params,
    status: 'pending',
  };

  fs.writeFileSync(commandsPath, JSON.stringify(cmd, null, 2));
  broadcast('command:pending', { commandId: cmd.id, command, ...((params as Record<string, unknown>) || {}) });
  res.json(cmd);
});

app.get('/api/commands', (req, res) => {
  const commandsPath = path.join(PROJECT_DIR, 'studio/commands.json');
  const logPath = path.join(PROJECT_DIR, 'studio/commands_log.json');

  const current = fs.existsSync(commandsPath) ? readJsonSafe(commandsPath, null) : null;
  const log = fs.existsSync(logPath) ? readJsonSafe<unknown[]>(logPath, []) : [];

  res.json({ current, log: log.slice(-20) });
});

app.delete('/api/commands/pending', (req, res) => {
  const commandsPath = path.join(PROJECT_DIR, 'studio/commands.json');
  if (!fs.existsSync(commandsPath)) return res.json({ message: 'No pending command' });

  const cmd = readJsonSafe<{ status?: string; id?: string }>(commandsPath, {});
  if (cmd.status !== 'pending') return res.json({ message: 'No pending command' });

  cmd.status = 'cancelled';
  fs.writeFileSync(commandsPath, JSON.stringify(cmd, null, 2));
  broadcast('command:result', { commandId: cmd.id, status: 'cancelled', result: 'Cancelled by user' });
  res.json({ message: 'Command cancelled' });
});

// ─── Pipeline Endpoints ───────────────────────────────────────────────────

app.post('/api/pipeline/:sceneId/run', (req, res) => {
  const { sceneId } = req.params;
  const { fromStage } = req.body as { fromStage?: string };

  if (pipelineState.running) {
    return res.status(409).json({ error: 'Pipeline already running', detail: `Running: ${pipelineState.sceneId}` });
  }

  // Pre-sync check
  const syncResult = syncTsxToSkillTemplate(sceneId);
  if (!syncResult.success) {
    return res.status(412).json({
      error: 'Pre-sync failed',
      detail: syncResult.message,
      details: syncResult.details,
    });
  }

  const pipelineScript = path.join(REMOTION_SKILL_DIR, 'pipeline.mjs');
  if (!fs.existsSync(pipelineScript)) {
    return res.status(500).json({ error: 'pipeline.mjs not found', detail: pipelineScript });
  }

  const jobId = runPipeline(sceneId, fromStage || null);
  res.json({ jobId, message: 'Pipeline started', syncResult });
});

app.post('/api/pipeline/sync', (req, res) => {
  const project = loadProject();
  if (!project) return res.status(404).json({ error: 'project.json not found' });

  const results = project.scenes.map(scene => {
    const result = syncTsxToSkillTemplate(scene.id);
    return { sceneId: scene.id, ...result };
  });

  res.json({ results, allOk: results.every(r => r.success) });
});

app.get('/api/pipeline/status', (req, res) => {
  res.json(pipelineState);
});

app.post('/api/pipeline/concat', (req, res) => {
  const project = loadProject();
  if (!project) return res.status(404).json({ error: 'project.json not found' });

  if (pipelineState.running) {
    return res.status(409).json({ error: 'Pipeline already running' });
  }

  // Check all renders exist
  const missing = project.scenes.filter(scene => {
    const outputPath = path.join(PROJECT_DIR, `output/scenes/${scene.id.toLowerCase().replace('scene', 'scene_')}.mp4`);
    return !fs.existsSync(outputPath);
  });

  if (missing.length > 0) {
    return res.status(412).json({ error: 'Missing renders', detail: missing.map(s => s.id) });
  }

  // Build file list and run ffmpeg
  const fileList = path.join(PROJECT_DIR, 'output/concat_list.txt');
  ensureDir(path.join(PROJECT_DIR, 'output'));
  const lines = project.scenes.map(scene => {
    const p = `output/scenes/${scene.id.toLowerCase().replace('scene', 'scene_')}.mp4`;
    return `file '${path.join(PROJECT_DIR, p)}'`;
  }).join('\n');
  fs.writeFileSync(fileList, lines);

  const outputFile = path.join(PROJECT_DIR, 'output/final.mp4');
  const proc = spawn('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', fileList, '-c', 'copy', outputFile]);

  proc.stdout.on('data', d => broadcast('pipeline:log', { level: 'info', message: d.toString().trim(), stage: 'concat' }));
  proc.stderr.on('data', d => broadcast('pipeline:log', { level: 'info', message: d.toString().trim(), stage: 'concat' }));
  proc.on('close', code => {
    broadcast('pipeline:done', {
      sceneId: 'all',
      jobId: 'concat',
      success: code === 0,
      outputPath: code === 0 ? 'output/final.mp4' : null,
      sizeBytes: code === 0 && fs.existsSync(outputFile) ? fs.statSync(outputFile).size : 0,
    });
  });

  res.json({ message: 'Concat started', outputFile });
});

// ─── Disk Endpoint ────────────────────────────────────────────────────────

app.get('/api/disk', async (req, res) => {
  const info = await getDiskInfo();
  res.json(info);
});

// ─── Cleanup Endpoint ─────────────────────────────────────────────────────

app.post('/api/project/cleanup', (req, res) => {
  const results: string[] = [];

  // Clear skill template scenes
  const skillScenes = path.join(REMOTION_SKILL_DIR, 'src/scenes');
  if (fs.existsSync(skillScenes)) {
    const files = fs.readdirSync(skillScenes).filter(f => f.endsWith('.tsx') && f !== 'index.tsx');
    files.forEach(f => {
      try { fs.unlinkSync(path.join(skillScenes, f)); results.push(`Removed: ${f}`); }
      catch { results.push(`Failed to remove: ${f}`); }
    });
  }

  // Clear webpack cache
  const cacheDir = path.join(REMOTION_SKILL_DIR, 'node_modules/.cache');
  if (fs.existsSync(cacheDir)) {
    try {
      spawn('rm', ['-rf', cacheDir]);
      results.push('Cleared webpack cache');
    } catch { results.push('Failed to clear webpack cache'); }
  }

  // Clear old renders in project output
  const outputDir = path.join(PROJECT_DIR, 'output');
  if (fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.mp4'));
    files.forEach(f => {
      try { fs.unlinkSync(path.join(outputDir, f)); results.push(`Removed render: ${f}`); }
      catch { results.push(`Failed to remove: ${f}`); }
    });
  }

  res.json({ message: 'Cleanup complete', results });
});

// ─── Video serving endpoints ──────────────────────────────────────────────

// Resolve the actual rendered MP4 path for a scene (tries multiple naming conventions)
function resolveVideoPath(sceneId: string): string | null {
  const candidates = [
    path.join(PROJECT_DIR, 'output', 'scenes', `${sceneId}.mp4`),
    path.join(PROJECT_DIR, 'output', 'scenes', `${sceneId.toLowerCase().replace('scene', 'scene_')}.mp4`),
    path.join(PROJECT_DIR, 'output', 'scenes', `${sceneId.toLowerCase()}.mp4`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// GET /api/scenes/:id/render-status
app.get('/api/scenes/:id/render-status', (req, res) => {
  const videoPath = resolveVideoPath(req.params.id);
  const exists = videoPath !== null;
  const size = exists ? fs.statSync(videoPath!).size : 0;
  res.json({ rendered: exists, size, path: videoPath || null });
});

// GET /api/scenes/:id/video — serves the rendered MP4 with range request support
app.get('/api/scenes/:id/video', (req, res) => {
  const videoPath = resolveVideoPath(req.params.id);
  if (!videoPath) {
    return res.status(404).json({ error: 'Scene not yet rendered' });
  }

  const stat = fs.statSync(videoPath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(videoPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

// ─── Static image/stills serving ─────────────────────────────────────────

app.get('/project-stills/:sceneId/:filename', (req, res) => {
  const { sceneId, filename } = req.params;
  // Sanitize paths
  const safe = filename.replace(/\.\./g, '').replace(/^\//, '');
  const filePath = path.join(PROJECT_DIR, 'output/stills', sceneId, safe);
  if (!filePath.startsWith(PROJECT_DIR)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.sendFile(filePath);
});

// ─── Catch-all for SPA ───────────────────────────────────────────────────

app.get('*', (req, res) => {
  const indexPath = path.join(SKILL_DIR, 'dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send(`
      <html><body style="background:#1a1a1f;color:#ccc;font-family:sans-serif;padding:40px">
        <h2>Remox Studio Backend Running</h2>
        <p>Project: <strong>${PROJECT_DIR}</strong></p>
        <p>API: <a href="/api/project" style="color:#60a5fa">/api/project</a></p>
        <p>Frontend: start with <code>npm run dev</code> (proxies to this server)</p>
      </body></html>
    `);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  const project = loadProject();
  console.log(`\n[Remox Studio] Server running at http://localhost:${PORT}`);
  console.log(`[Remox Studio] Project: ${PROJECT_DIR}`);
  if (project) {
    console.log(`[Remox Studio] Title: ${project.title}`);
    console.log(`[Remox Studio] Scenes: ${project.scenes.length}`);
  } else {
    console.warn('[Remox Studio] WARNING: project.json not found at', PROJECT_DIR);
  }
  console.log('[Remox Studio] WebSocket: ws://localhost:3847/ws\n');
  startFileWatcher();
});

export default app;
