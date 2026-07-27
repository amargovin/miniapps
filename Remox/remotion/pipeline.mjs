#!/usr/bin/env node
/**
 * pipeline.mjs — Deterministic pipeline controller for the Remox video production pipeline.
 *
 * Enforces all production stages mechanically. Calls external tools (whisper,
 * audit, validate, render) via subprocess. LLM agents (pre-production, producer)
 * run BEFORE pipeline — this script validates their output and gates on it.
 *
 * Usage:
 *   node pipeline.mjs project.json --scene Scene01
 *   node pipeline.mjs project.json --all
 *   node pipeline.mjs project.json --scene Scene01 --dry-run
 *   node pipeline.mjs project.json --scene Scene01 --from audit
 *   node pipeline.mjs project.json --status
 *   node pipeline.mjs project.json --all --auto-approve
 *   node pipeline.mjs project.json --scene Scene01 --project-dir /path/to/project
 *
 * Exit codes:
 *   0 = all pass
 *   1 = gate failure
 *   2 = usage error
 *   3 = preview ready — keyframe stills generated, waiting for approval
 *       (write output/.preview-ready and exit; caller reviews stills then re-runs)
 */

import {
  readFileSync, existsSync, statSync, mkdirSync, writeFileSync, unlinkSync,
} from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function argVal(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
}
function argHas(flag) { return args.includes(flag); }

const projectPath = args.find(a => !a.startsWith('--') && (a.endsWith('.json') || a.endsWith('.json')));
if (!projectPath) {
  console.error('Usage: node pipeline.mjs <project.json> [--scene SceneXX | --all | --status] [--dry-run] [--from <stage>] [--auto-approve] [--project-dir <path>]');
  process.exit(2);
}

const sceneFlag   = argVal('--scene');
const runAll      = argHas('--all');
const dryRun      = argHas('--dry-run');
const statusMode  = argHas('--status');
const fromStage   = argVal('--from');
const autoApprove = argHas('--auto-approve');
const projectDirFlag = argVal('--project-dir');

// Stage name → 1-based index
// NOTE: audiosync stage added between tsx(5) and audit(6); stages renumbered internally.
const STAGE_NAMES = ['audio', 'whisper', 'brief', 'images', 'tsx', 'audiosync', 'registry', 'audit', 'preview', 'validate', 'render', 'log'];
const fromStageIdx = fromStage
  ? STAGE_NAMES.indexOf(fromStage.toLowerCase()) + 1
  : 1;
if (fromStage && fromStageIdx === 0) {
  console.error(`Unknown stage "${fromStage}". Valid: ${STAGE_NAMES.join(', ')}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Project loading
// ---------------------------------------------------------------------------
const projectAbsPath = resolve(projectPath);

// projectDir is the canonical location of all project assets (audio/, briefs/, output/).
// Can be overridden with --project-dir so projects live in the user's working directory
// rather than next to project.json when they are in different locations.
const projectDir = projectDirFlag
  ? resolve(projectDirFlag)
  : dirname(projectAbsPath);

let project;
try {
  project = JSON.parse(readFileSync(projectAbsPath, 'utf-8'));
} catch (err) {
  console.error(`Cannot read project.json: ${err.message}`);
  process.exit(2);
}

const fps    = project.fps   || 30;
const title  = project.title || basename(projectDir);
const scenes = project.scenes || [];

// ---------------------------------------------------------------------------
// File system paths
// ---------------------------------------------------------------------------
// toolsDir: where the pipeline's .mjs tools live (always the skill).
// remotionDir: the SOURCE TREE being built — prefer the project's scaffolded
// remotion/ (project isolation); fall back to the skill template only for
// legacy projects without one.
const toolsDir         = __dirname;
const projectRemotion  = resolve(projectDir, 'remotion');
const remotionDir      = existsSync(join(projectRemotion, 'src', 'index.ts'))
  ? projectRemotion
  : __dirname;
const whisperScript    = resolve(__dirname, '..', 'scripts', 'whisper_timestamps.py');
const auditScript      = resolve(toolsDir, 'audit.mjs');
const audiosyncScript  = resolve(toolsDir, 'audiosync.mjs');
const validateScript   = resolve(toolsDir, 'validate.mjs');
const renderScript     = resolve(toolsDir, 'render.mjs');
const preflightScript  = resolve(toolsDir, 'preflight.mjs');
const logPath          = resolve(projectDir, 'production_log.json');
const outputDir        = resolve(projectDir, 'output');
const scenesOutDir     = resolve(outputDir, 'scenes');
const previewReadyPath = resolve(outputDir, '.preview-ready');

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------
const TICK  = '\u2705';   // checkmark box
const CROSS = '\u274C';   // red X
const WARN  = '\u26A0\uFE0F '; // warning
const SKIP  = '\u23ED ';  // skip forward

// Stages: 1=audio 2=whisper 3=brief 4=images 5=tsx 6=audiosync 7=registry 8=audit 9=preview 10=validate 11=render 12=log
const TOTAL_STAGES = 12;

function padLabel(label, width = 22) {
  return label.padEnd(width, '.');
}

function sizeStr(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024)         return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

function hr() {
  return '\u2550'.repeat(51);
}

function printStage(n, label, icon, detail) {
  console.log(`[${n}/${TOTAL_STAGES}] ${padLabel(label.toUpperCase())} ${icon} ${detail}`);
}

// ---------------------------------------------------------------------------
// YAML helpers — minimal regex parser, no external dep
// ---------------------------------------------------------------------------

/** Count list items directly under a given key (works for phases: list) */
function yamlCountList(yaml, key) {
  const startRe = new RegExp(`^\\s*${key}:\\s*$`, 'm');
  const idx = yaml.search(startRe);
  if (idx === -1) return 0;
  const after = yaml.slice(idx);
  const lines  = after.split('\n').slice(1);
  let count = 0;
  for (const line of lines) {
    if (/^\s+-/.test(line)) count++;
    else if (line.trim() && !/^\s/.test(line)) break;
  }
  return count;
}

/** Extract file: values from the assets_needed.images block */
function yamlGetImageFiles(yaml) {
  // Find assets_needed block
  const assetsIdx = yaml.indexOf('assets_needed:');
  if (assetsIdx === -1) return [];
  const assetsBlock = yaml.slice(assetsIdx);

  // Find images: sub-block inside assets_needed
  const imagesIdx = assetsBlock.indexOf('images:');
  if (imagesIdx === -1) return [];
  const afterImages = assetsBlock.slice(imagesIdx + 'images:'.length);

  // Collect lines until we hit a top-level key (no leading spaces)
  const lines = afterImages.split('\n');
  const imageBlock = [];
  for (const line of lines) {
    if (!line.trim()) { imageBlock.push(line); continue; }
    if (/^\S/.test(line)) break; // top-level key
    if (/^\s{2,}/.test(line)) imageBlock.push(line); // still in block
  }

  const files = [];
  const fileRe = /file:\s*['"]?([^\s'"]+)['"]?/g;
  let m;
  while ((m = fileRe.exec(imageBlock.join('\n'))) !== null) {
    files.push(m[1].trim());
  }
  return files;
}

// ---------------------------------------------------------------------------
// Subprocess runner
// ---------------------------------------------------------------------------
function run(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, {
      cwd: remotionDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout || 600000,
    });
    return { ok: true, stdout: stdout || '', stderr: '', code: 0 };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      code:   err.status || 1,
    };
  }
}

// ---------------------------------------------------------------------------
// Scene ID helpers (mirrors audit.mjs logic exactly)
// ---------------------------------------------------------------------------
function sceneIdToFileName(id) {
  // Scene01 → Scene_01, Scene07 → Scene_07
  return id.replace(/^(Scene)(\d)/, '$1_$2');
}

function sceneIdToAudioNum(id) {
  const m = id.match(/(\d+)$/);
  return m ? m[1].padStart(2, '0') : '01';
}

// ---------------------------------------------------------------------------
// Production log (append-only JSON array)
// ---------------------------------------------------------------------------
function readLog() {
  if (!existsSync(logPath)) return [];
  try { return JSON.parse(readFileSync(logPath, 'utf-8')); }
  catch { return []; }
}

function appendLog(entry) {
  const entries = readLog();
  entries.push({ ...entry, timestamp: new Date().toISOString() });
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, JSON.stringify(entries, null, 2));
}

// ---------------------------------------------------------------------------
// STATUS MODE
// ---------------------------------------------------------------------------
function showStatus() {
  console.log(hr());
  console.log(`PIPELINE STATUS \u2014 ${title}`);
  console.log(hr());
  console.log('');

  const logByScene = {};
  for (const e of readLog()) logByScene[e.scene] = e;

  for (const scene of scenes) {
    const { id, durationFrames } = scene;
    const audioNum = sceneIdToAudioNum(id);
    const fileName = sceneIdToFileName(id);
    const secs     = (durationFrames / fps).toFixed(1);

    const audio    = existsSync(join(projectDir, 'audio',  `scene_${audioNum}.mp3`));
    const whisper  = existsSync(join(projectDir, 'audio',  `scene_${audioNum}_whisper.json`));
    const brief    = existsSync(join(projectDir, 'briefs', `${id}_brief.yml`)) ||
                     existsSync(join(projectDir, 'briefs', `${fileName}_brief.yml`));
    const tsx      = existsSync(join(remotionDir, 'src', 'scenes', `${fileName}.tsx`));
    const rendered = existsSync(join(scenesOutDir, `${id}.mp4`));

    const last = logByScene[id] ? ` | rendered: ${logByScene[id].timestamp.slice(0, 10)}` : '';
    const check = (v) => v ? TICK : CROSS;

    console.log(`  ${id.padEnd(10)} ${durationFrames}f ${secs.padStart(5)}s` +
      `  audio:${check(audio)} whisper:${check(whisper)} brief:${check(brief)}` +
      ` tsx:${check(tsx)} render:${check(rendered)}${last}`);
  }

  console.log('');
  console.log(hr());
}

// ---------------------------------------------------------------------------
// MAIN PIPELINE — single scene
// ---------------------------------------------------------------------------
async function runScene(scene) {
  const { id, durationFrames } = scene;
  const audioNum  = sceneIdToAudioNum(id);
  const fileName  = sceneIdToFileName(id);
  const secs      = (durationFrames / fps).toFixed(1);

  // Result accumulator
  const result = {
    scene: id,
    success: false,
    durationFrames,
    durationSecs: parseFloat(secs),
    stages: {},
  };

  // Helper: should this stage run?
  function shouldRun(n) { return n >= fromStageIdx; }

  console.log('');
  console.log(hr());
  console.log(`PIPELINE \u2014 ${title}`);
  console.log(`Scene: ${id} (${durationFrames} frames, ${secs}s)${dryRun ? '  [DRY RUN]' : ''}`);
  console.log(hr());
  console.log('');

  // =========================================================================
  // STAGE 1: AUDIO CHECK
  // =========================================================================
  {
    const n = 1;
    const audioPath   = join(projectDir, 'audio', `scene_${audioNum}.mp3`);
    const audioExists = existsSync(audioPath);
    const detail      = audioExists
      ? `scene_${audioNum}.mp3 (${sizeStr(statSync(audioPath).size)})`
      : `MISSING: audio/scene_${audioNum}.mp3`;

    result.stages.audio = { pass: audioExists, path: audioPath };

    if (!shouldRun(n)) {
      printStage(n, 'audio', SKIP, `skipped (--from ${fromStage})`);
    } else {
      printStage(n, 'audio', audioExists ? TICK : CROSS, detail);
      if (!audioExists) return result;
    }
  }

  // =========================================================================
  // STAGE 2: WHISPER TIMESTAMPS
  // =========================================================================
  {
    const n = 2;
    const audioPath   = join(projectDir, 'audio', `scene_${audioNum}.mp3`);
    const whisperPath = join(projectDir, 'audio', `scene_${audioNum}_whisper.json`);
    let   whisperExists = existsSync(whisperPath);

    if (!shouldRun(n)) {
      printStage(n, 'whisper', SKIP, `skipped (--from ${fromStage})`);
      result.stages.whisper = { pass: true, skipped: true };
    } else if (dryRun) {
      const detail = whisperExists
        ? `scene_${audioNum}_whisper.json (exists)`
        : `MISSING: would run whisper_timestamps.py`;
      printStage(n, 'whisper', whisperExists ? TICK : SKIP, detail);
      result.stages.whisper = { pass: whisperExists, dryRun: true };
      if (!whisperExists) return result;
    } else {
      // Run whisper if missing
      if (!whisperExists) {
        process.stdout.write(`[${n}/${TOTAL_STAGES}] ${padLabel('WHISPER')} running...\r`);
        const r = run(
          `python3 "${whisperScript}" --audio "${audioPath}" --output "${whisperPath}"`,
          { cwd: projectDir }
        );
        whisperExists = existsSync(whisperPath);
        if (!whisperExists) {
          const errMsg = (r.stderr || r.stdout || 'unknown error').split('\n').filter(Boolean).pop() || 'failed';
          printStage(n, 'whisper', CROSS, `Whisper failed: ${errMsg}`);
          result.stages.whisper = { pass: false, error: errMsg };
          return result;
        }
      }

      // Parse whisper JSON
      try {
        const wData    = JSON.parse(readFileSync(whisperPath, 'utf-8'));
        const words    = wData.words?.length || 0;
        const durMs    = wData.audioDurationMs || 0;
        if (words === 0) {
          printStage(n, 'whisper', CROSS, `Empty whisper file (0 words) — delete and re-run`);
          result.stages.whisper = { pass: false, error: 'empty' };
          return result;
        }
        printStage(n, 'whisper', TICK, `scene_${audioNum}_whisper.json (${words} words, ${durMs}ms)`);
        result.stages.whisper = { pass: true, words, durationMs: durMs };
      } catch (e) {
        printStage(n, 'whisper', CROSS, `Cannot parse whisper JSON: ${e.message}`);
        result.stages.whisper = { pass: false, error: 'parse error' };
        return result;
      }
    }
  }

  // =========================================================================
  // STAGE 3: BRIEF CHECK
  // =========================================================================
  let briefPath   = '';
  let briefPhases = 0;
  let briefImages = 0;
  let briefImageFiles = [];

  {
    const n      = 3;
    const path1  = join(projectDir, 'briefs', `${id}_brief.yml`);
    const path2  = join(projectDir, 'briefs', `${fileName}_brief.yml`);
    briefPath    = existsSync(path1) ? path1 : path2;
    const exists = existsSync(briefPath);

    let detail = `MISSING: briefs/${id}_brief.yml`;
    if (exists) {
      try {
        const yml   = readFileSync(briefPath, 'utf-8');
        briefPhases = yamlCountList(yml, 'phases');
        briefImageFiles = yamlGetImageFiles(yml);
        briefImages = briefImageFiles.length;
        detail = `${basename(briefPath)} (${briefPhases} phases, ${briefImages} images)`;
      } catch {
        detail = basename(briefPath);
      }
    }

    result.stages.brief = { pass: exists, path: briefPath };

    if (!shouldRun(n)) {
      printStage(n, 'brief', SKIP, `skipped (--from ${fromStage})`);
    } else {
      printStage(n, 'brief', exists ? TICK : CROSS, detail);
      if (!exists) return result;
    }
  }

  // =========================================================================
  // STAGE 4: IMAGE ASSETS
  // =========================================================================
  {
    const n           = 4;
    const imagesDir   = join(remotionDir, 'public', 'images');
    const present     = briefImageFiles.filter(f => existsSync(join(imagesDir, f)));
    const missing     = briefImageFiles.filter(f => !existsSync(join(imagesDir, f)));
    const allPresent  = missing.length === 0;

    let detail;
    if (briefImageFiles.length === 0) {
      detail = 'no images in brief';
    } else if (allPresent) {
      detail = `${present.length}/${briefImageFiles.length} assets present`;
    } else {
      detail = `${present.length}/${briefImageFiles.length} present \u2014 MISSING: ${missing.join(', ')}`;
    }

    result.stages.images = { pass: allPresent, present: present.length, total: briefImageFiles.length, missing };

    if (!shouldRun(n)) {
      printStage(n, 'images', SKIP, `skipped (--from ${fromStage})`);
    } else {
      printStage(n, 'images', allPresent ? TICK : CROSS, detail);
      if (!allPresent && briefImageFiles.length > 0) return result;
    }
  }

  // =========================================================================
  // STAGE 5: TSX CHECK
  // =========================================================================
  {
    const n       = 5;
    const tsxPath = join(remotionDir, 'src', 'scenes', `${fileName}.tsx`);
    const exists  = existsSync(tsxPath);
    let detail    = `MISSING: src/scenes/${fileName}.tsx`;
    if (exists) {
      const lines = readFileSync(tsxPath, 'utf-8').split('\n').length;
      detail = `${fileName}.tsx (${lines} lines)`;
    }

    result.stages.tsx = { pass: exists, path: tsxPath };

    if (!shouldRun(n)) {
      printStage(n, 'tsx', SKIP, `skipped (--from ${fromStage})`);
    } else {
      printStage(n, 'tsx', exists ? TICK : CROSS, detail);
      if (!exists) return result;
    }
  }

  // =========================================================================
  // STAGE 6: AUDIOSYNC --fix (auto-correct frame math after TSX generation)
  // Runs audiosync.mjs --fix on this scene so durations match Whisper anchors.
  // Non-fatal: logs a warning if it fails but does not block the pipeline.
  // =========================================================================
  {
    const n = 6;
    result.stages.audiosync = { pass: true };

    if (!shouldRun(n)) {
      printStage(n, 'audiosync', SKIP, `skipped (--from ${fromStage})`);
    } else if (dryRun) {
      printStage(n, 'audiosync', SKIP, 'dry-run \u2014 not executed');
    } else {
      process.stdout.write(`[${n}/${TOTAL_STAGES}] ${padLabel('AUDIOSYNC')} fixing frame math...\r`);
      const r = run(`node "${audiosyncScript}" "${projectAbsPath}" --scene ${id} --fix`);

      if (r.ok) {
        // Extract summary line if present
        const summary = (r.stdout || '').split('\n')
          .find(l => /pass|fix|wrote/i.test(l))?.trim() || 'durations corrected';
        printStage(n, 'audiosync', TICK, summary);
        result.stages.audiosync = { pass: true };
      } else {
        // Non-fatal — audiosync may fail if whisper file is absent (already caught earlier)
        const errLine = (r.stderr || r.stdout || '').split('\n')
          .find(l => l.trim())?.trim() || 'could not fix — check whisper file';
        printStage(n, 'audiosync', WARN, `${errLine} (non-fatal — audit will catch misalignment)`);
        result.stages.audiosync = { pass: false, warning: errLine };
      }
    }
  }

  // =========================================================================
  // STAGE 7: SCENE REGISTRY (auto-generate from project.json + detected TSX)
  // =========================================================================
  {
    const n            = 7;
    const registryPath = join(remotionDir, 'src', 'SceneRegistry.ts');
    const scenesDir    = join(remotionDir, 'src', 'scenes');

    result.stages.registry = { pass: false };

    if (!shouldRun(n)) {
      printStage(n, 'registry', SKIP, `skipped (--from ${fromStage})`);
      result.stages.registry = { pass: true, skipped: true };
    } else if (dryRun) {
      printStage(n, 'registry', SKIP, 'dry-run \u2014 not executed');
      result.stages.registry = { pass: true, dryRun: true };
    } else {
      // Collect all scenes from project.json that have TSX files
      const registeredScenes = [];
      for (const s of scenes) {
        const fn = sceneIdToFileName(s.id);
        const tsxFile = join(scenesDir, `${fn}.tsx`);
        if (existsSync(tsxFile)) {
          registeredScenes.push({ id: s.id, fileName: fn });
        }
      }

      if (registeredScenes.length === 0) {
        printStage(n, 'registry', WARN, 'no scene TSX files found \u2014 skipping registry generation');
        result.stages.registry = { pass: true, warning: 'no scenes' };
      } else {
        // Auto-generate SceneRegistry.ts
        const imports = registeredScenes
          .map(s => `import ${s.fileName} from './scenes/${s.fileName}';`)
          .join('\n');
        const entries = registeredScenes
          .map(s => `  '${s.id}': ${s.fileName},`)
          .join('\n');
        const registryContent = `// AUTO-GENERATED by pipeline.mjs \u2014 do not edit manually.
import React from 'react';
${imports}

const registry: Record<string, React.FC> = {
${entries}
};

export default registry;
`;
        mkdirSync(dirname(registryPath), { recursive: true });
        writeFileSync(registryPath, registryContent);

        // Studio Review Loop: regenerate the per-scene compositions manifest
        const manifestPath = join(remotionDir, 'src', 'scenesManifest.json');
        writeFileSync(manifestPath, JSON.stringify({
          scenes: project.scenes.map(s => ({ id: s.id, durationFrames: s.durationFrames, audio: s.audio })),
        }, null, 2));

        printStage(n, 'registry', TICK, `auto-generated SceneRegistry.ts + scenesManifest.json (${registeredScenes.length} scenes)`);
        result.stages.registry = { pass: true, scenes: registeredScenes.length };
      }
    }
  }

  // =========================================================================
  // STAGE 8: MECHANICAL AUDIT (hard gate)
  // =========================================================================
  {
    const n = 8;
    result.stages.audit = { pass: false };

    if (!shouldRun(n)) {
      printStage(n, 'audit', SKIP, `skipped (--from ${fromStage})`);
      result.stages.audit = { pass: true, skipped: true };
    } else if (dryRun) {
      printStage(n, 'audit', SKIP, 'dry-run \u2014 not executed');
      result.stages.audit = { pass: true, dryRun: true };
    } else {
      process.stdout.write(`[${n}/${TOTAL_STAGES}] ${padLabel('AUDIT')} running...\r`);
      const r = run(`node "${auditScript}" "${projectAbsPath}" --scene ${id}`);

      // Parse totals line: "TOTALS: X pass, Y fail, Z warn"
      const totalsMatch = (r.stdout + r.stderr).match(/TOTALS:\s*(\d+)\s*pass,\s*(\d+)\s*fail,\s*(\d+)\s*warn/i);
      const passCount = totalsMatch ? parseInt(totalsMatch[1]) : 0;
      const failCount = totalsMatch ? parseInt(totalsMatch[2]) : (r.ok ? 0 : 1);
      const warnCount = totalsMatch ? parseInt(totalsMatch[3]) : 0;
      const auditOk   = r.ok && failCount === 0;

      result.stages.audit = { pass: auditOk, passCount, failCount, warnCount };

      if (auditOk) {
        printStage(n, 'audit', TICK, `${passCount} pass, ${failCount} fail, ${warnCount} warn`);
      } else {
        const failLines = (r.stdout + r.stderr).split('\n')
          .filter(l => l.includes('\u274C') || (l.includes('FAIL') && !l.includes('0 fail')))
          .slice(0, 4);
        const summary = failCount > 0
          ? `${failCount} hard failure(s) \u2014 fix before render`
          : 'audit did not pass';
        printStage(n, 'audit', CROSS, summary);
        for (const line of failLines) {
          if (line.trim()) console.log(`         ${line.trim()}`);
        }
        return result;
      }
    }
  }

  // =========================================================================
  // STAGE 9: VISUAL PREVIEW — keyframe stills before render
  //
  // Runs validate.mjs --audit to generate keyframe stills in output/stills/.
  // Without --auto-approve: writes output/.preview-ready and exits with code 3
  //   so the caller (Claude) can show the stills to the user before rendering.
  // With --auto-approve: logs the stills path and continues directly to render.
  // =========================================================================
  {
    const n = 9;
    result.stages.preview = { pass: false };

    if (!shouldRun(n)) {
      printStage(n, 'preview', SKIP, `skipped (--from ${fromStage})`);
      result.stages.preview = { pass: true, skipped: true };
    } else if (dryRun) {
      printStage(n, 'preview', SKIP, 'dry-run \u2014 not executed');
      result.stages.preview = { pass: true, dryRun: true };
    } else {
      process.stdout.write(`[${n}/${TOTAL_STAGES}] ${padLabel('PREVIEW')} generating keyframe stills...\r`);

      const tempProject = { ...project, scenes: [scene] };
      const tempPath    = join(outputDir, `_tmp_preview_${id}.json`);
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(tempPath, JSON.stringify(tempProject, null, 2));

      let previewOk = false;
      let errSummary = '';
      try {
        const r = run(`node "${validateScript}" "${tempPath}" --audit`, { timeout: 300000 });
        previewOk = r.ok;
        if (!previewOk) {
          errSummary = (r.stderr || r.stdout || 'unknown error')
            .split('\n')
            .filter(l => l.trim() && !l.match(/Bundl|progress|%/i))
            .slice(-3)
            .join(' | ');
        }
      } finally {
        try { unlinkSync(tempPath); } catch {}
      }

      result.stages.preview = { pass: previewOk };

      if (previewOk) {
        const stillsPath = join(outputDir, 'stills');
        printStage(n, 'preview', TICK, `keyframe stills at output/stills/${id}/`);

        if (!autoApprove) {
          // Write marker file and exit with code 3 — caller reviews stills then re-runs
          // with --from preview (or --from validate to skip preview) after approval.
          mkdirSync(outputDir, { recursive: true });
          writeFileSync(previewReadyPath, JSON.stringify({
            scene: id,
            stillsDir: stillsPath,
            timestamp: new Date().toISOString(),
            message: 'Review keyframe stills in output/stills/ then re-run with --from validate to proceed to render.',
          }, null, 2));
          console.log('');
          console.log(`\u{1F5BC}  Keyframe preview stills generated at output/stills/ \u2014 review before rendering`);
          console.log(`   Re-run with --from validate (or pass --auto-approve to skip this gate)`);
          console.log('');
          // Exit 3 = preview ready, waiting for approval
          process.exit(3);
        } else {
          console.log(`   (--auto-approve: skipping review gate)`);
        }
      } else {
        printStage(n, 'preview', WARN, `keyframe stills failed (${errSummary || 'unknown'}) \u2014 continuing`);
        // Non-fatal: validate (frame 0) in stage 10 will catch real render errors.
        result.stages.preview = { pass: true, warning: errSummary };
      }
    }
  }

  // =========================================================================
  // STAGE 10: VALIDATE (render frame 0)
  // =========================================================================
  {
    const n = 10;
    result.stages.validate = { pass: false };

    if (!shouldRun(n)) {
      printStage(n, 'validate', SKIP, `skipped (--from ${fromStage})`);
      result.stages.validate = { pass: true, skipped: true };
    } else if (dryRun) {
      printStage(n, 'validate', SKIP, 'dry-run \u2014 not executed');
      result.stages.validate = { pass: true, dryRun: true };
    } else {
      process.stdout.write(`[${n}/${TOTAL_STAGES}] ${padLabel('VALIDATE')} rendering frame 0...\r`);

      // validate.mjs has no --scene flag; pass a temp project with only this scene
      const tempProject = { ...project, scenes: [scene] };
      const tempPath    = join(outputDir, `_tmp_validate_${id}.json`);
      mkdirSync(outputDir, { recursive: true });
      writeFileSync(tempPath, JSON.stringify(tempProject, null, 2));

      let validateOk = false;
      let errSummary = '';
      try {
        const r = run(`node "${validateScript}" "${tempPath}"`, { timeout: 300000 });
        validateOk = r.ok;
        if (!validateOk) {
          errSummary = (r.stderr || r.stdout || 'unknown error')
            .split('\n')
            .filter(l => l.trim() && !l.match(/Bundl|progress|%/i))
            .slice(-3)
            .join(' | ');
        }
      } finally {
        try { unlinkSync(tempPath); } catch {}
      }

      result.stages.validate = { pass: validateOk };

      if (validateOk) {
        printStage(n, 'validate', TICK, 'frame 0 renders clean');
      } else {
        printStage(n, 'validate', CROSS, errSummary || 'frame 0 render failed');
        return result;
      }
    }
  }

  // =========================================================================
  // STAGE 11: RENDER
  // =========================================================================
  {
    const n            = 11;
    const renderOutPath = join(scenesOutDir, `${id}.mp4`);
    result.stages.render = { pass: false };

    if (!shouldRun(n)) {
      printStage(n, 'render', SKIP, `skipped (--from ${fromStage})`);
      result.stages.render = { pass: true, skipped: true };
    } else if (dryRun) {
      printStage(n, 'render', SKIP, 'dry-run \u2014 not executed');
      result.stages.render = { pass: true, dryRun: true };
    } else {
      mkdirSync(scenesOutDir, { recursive: true });
      process.stdout.write(`[${n}/${TOTAL_STAGES}] ${padLabel('RENDER')} rendering ${durationFrames} frames...\r`);

      const r = run(
        `node "${renderScript}" "${projectAbsPath}" "${renderOutPath}" --scene ${id}`,
        { timeout: 1800000 }  // 30 min max
      );

      const fileExists  = existsSync(renderOutPath);
      const fileSize    = fileExists ? statSync(renderOutPath).size : 0;
      const renderOk    = fileExists && fileSize > 100 * 1024;

      result.stages.render = {
        pass: renderOk,
        outputPath: renderOutPath,
        sizeBytes: fileSize,
        sizeStr: sizeStr(fileSize),
      };

      if (renderOk) {
        printStage(n, 'render', TICK, `${id}.mp4 (${sizeStr(fileSize)}, ${secs}s)`);
      } else {
        let errDetail = !fileExists
          ? 'output file was not created'
          : `output too small (${sizeStr(fileSize)}) \u2014 render may have crashed`;
        const errorLines = (r.stderr || r.stdout || '').split('\n')
          .filter(l => /error|BLOCKED|fail/i.test(l))
          .slice(0, 2)
          .map(l => l.trim())
          .join(' | ');
        if (errorLines) errDetail += ` \u2014 ${errorLines}`;
        printStage(n, 'render', CROSS, errDetail);
        return result;
      }
    }
  }

  // =========================================================================
  // STAGE 12: LOG
  // =========================================================================
  {
    const n = 12;
    result.success = true;

    appendLog({
      scene:         id,
      success:       true,
      durationFrames,
      durationSecs:  parseFloat(secs),
      phases:        briefPhases,
      images:        briefImages,
      renderSizeStr: result.stages.render?.sizeStr || 'n/a',
      renderPath:    result.stages.render?.outputPath || '',
      dryRun:        dryRun || undefined,
    });

    result.stages.log = { pass: true };
    printStage(n, 'log', TICK, 'written to production_log.json');
  }

  // =========================================================================
  // SCENE FOOTER
  // =========================================================================
  const summaryParts = [];
  if (briefPhases) summaryParts.push(`${briefPhases} phases`);
  if (briefImages) summaryParts.push(`${briefImages} images`);
  if (result.stages.render?.sizeStr && !dryRun) summaryParts.push(result.stages.render.sizeStr);

  console.log('');
  console.log(hr());
  console.log(`${id.toUpperCase()} COMPLETE${summaryParts.length ? ' \u2014 ' + summaryParts.join(', ') : ''}`);
  console.log(hr());

  return result;
}

// ---------------------------------------------------------------------------
// PREFLIGHT — runs once before the first scene (not inside runScene)
// ---------------------------------------------------------------------------
function runPreflight() {
  console.log('');
  console.log(hr());
  console.log('REMOX PIPELINE \u2014 Pre-flight checks');
  console.log(hr());

  const r = run(`node "${preflightScript}" "${projectDir}"`);
  if (r.ok) {
    // Print the preflight output so the user can see the checks
    process.stdout.write(r.stdout);
  } else {
    process.stdout.write(r.stdout);
    process.stderr.write(r.stderr);
    console.error('');
    console.error('Pre-flight checks failed. Fix the issues above before running the pipeline.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// ENTRYPOINT
// ---------------------------------------------------------------------------
async function main() {
  if (statusMode) {
    showStatus();
    process.exit(0);
  }

  // Run preflight checks before any scene processing
  if (!dryRun && !fromStage) {
    // Skip preflight when --from is specified (user is resuming mid-pipeline)
    runPreflight();
  }

  // Determine which scenes to run
  const scenesToRun = runAll
    ? scenes
    : sceneFlag
      ? scenes.filter(s => s.id === sceneFlag)
      : [];

  if (scenesToRun.length === 0) {
    if (sceneFlag) {
      console.error(`Scene "${sceneFlag}" not found in project.json`);
      console.error(`Available: ${scenes.map(s => s.id).join(', ')}`);
    } else {
      console.error('Specify --scene SceneXX, --all, or --status');
    }
    process.exit(2);
  }

  let anyFailed = false;

  for (const scene of scenesToRun) {
    const result = await runScene(scene);

    if (!result.success) {
      anyFailed = true;

      // Log the failure too
      appendLog({
        scene:   result.scene,
        success: false,
        stages:  result.stages,
        failedAt: Object.entries(result.stages).find(([, v]) => !v.pass)?.[0] || 'unknown',
      });

      if (!runAll) {
        process.exit(1);
      }

      console.log('');
      console.log(`${CROSS} ${scene.id} FAILED \u2014 continuing to next scene`);
    }
  }

  if (runAll && scenesToRun.length > 1) {
    const log      = readLog().filter(e => scenesToRun.some(s => s.id === e.scene));
    // Count most recent entry per scene
    const latest = {};
    for (const e of log) latest[e.scene] = e;
    const passed = Object.values(latest).filter(e => e.success).length;
    const failed = scenesToRun.length - passed;

    console.log('');
    console.log(hr());
    console.log(`ALL SCENES \u2014 ${passed}/${scenesToRun.length} passed${failed > 0 ? `, ${failed} failed` : ''}`);
    console.log(hr());
  }

  process.exit(anyFailed ? 1 : 0);
}

main().catch(err => {
  console.error('Pipeline crashed:', err.message);
  process.exit(1);
});
