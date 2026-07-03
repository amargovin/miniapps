#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { cpus } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';
import { createRequire } from 'module';

// Load Remotion tooling from the SAME tree as the source being bundled, so
// bundler/renderer/remotion versions always match (mixed trees cause
// "export not found" webpack errors).
async function loadRemotionTooling(remotionRoot) {
  const req = createRequire(join(remotionRoot, 'package.json'));
  const { bundle } = await import(pathToFileURL(req.resolve('@remotion/bundler')).href);
  const { renderMedia, selectComposition } = await import(pathToFileURL(req.resolve('@remotion/renderer')).href);
  return { bundle, renderMedia, selectComposition };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectPath = process.argv[2];
const outputPath = process.argv[3] || './output/final.mp4';

if (!projectPath) {
  console.error('Usage: node render.mjs <project.json> [output.mp4]');
  process.exit(1);
}

const project = JSON.parse(readFileSync(resolve(projectPath), 'utf-8'));
const fps = project.fps || 30;
const width = project.width || 1920;
const height = project.height || 1080;

// Parse --scene flag to render only specific scene(s)
const sceneFlag = process.argv.find(a => a.startsWith('--scene'));
const sceneFilterArg = sceneFlag ? process.argv[process.argv.indexOf(sceneFlag) + 1] : null;
const sceneFilter = sceneFilterArg ? new Set(sceneFilterArg.split(',')) : null;

// Project-relative output directories (persistent)
const projectDir = project.projectDir ? resolve(project.projectDir) : dirname(resolve(projectPath));
const scenesDir = resolve(projectDir, 'output', 'scenes');
if (!existsSync(scenesDir)) mkdirSync(scenesDir, { recursive: true });

// Ensure final output directory exists
const outDir = dirname(resolve(outputPath));
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Parse --skip-audit-gate flag (escape hatch for emergencies)
const skipAuditGate = process.argv.includes('--skip-audit-gate');

async function main() {
  // -----------------------------------------------------------------------
  // Audit gate: refuse to render without a passing audit result
  // -----------------------------------------------------------------------
  const auditResultPath = resolve(projectDir, 'output', 'audit_result.json');
  if (!skipAuditGate) {
    if (!existsSync(auditResultPath)) {
      console.error('BLOCKED: No audit result found at ' + auditResultPath);
      console.error('Run audit.mjs first:  node audit.mjs ' + projectPath);
      console.error('To bypass (emergency only): add --skip-audit-gate');
      process.exit(1);
    }
    const auditResult = JSON.parse(readFileSync(auditResultPath, 'utf-8'));
    if (auditResult.verdict !== 'PASS') {
      console.error(`BLOCKED: Audit verdict is ${auditResult.verdict} (${auditResult.hard_rule_failures} failures)`);
      console.error('Fix failures and re-run audit.mjs before rendering.');
      console.error('To bypass (emergency only): add --skip-audit-gate');
      process.exit(1);
    }
    // If filtering to specific scene(s), check they were included in the audit
    if (sceneFilter) {
      const auditedScenes = new Set(auditResult.scenes_audited || []);
      for (const sceneId of sceneFilter) {
        if (!auditedScenes.has(sceneId)) {
          console.error(`BLOCKED: ${sceneId} was not included in the audit (audited: ${[...auditedScenes].join(', ')})`);
          console.error(`Re-run: node audit.mjs ${projectPath} --scene ${sceneId}`);
          process.exit(1);
        }
      }
    }
    console.log(`Audit gate: PASS (${auditResult.timestamp})`);
  } else {
    console.log('WARNING: Audit gate SKIPPED (--skip-audit-gate)');
  }

  // Source tree: prefer the project's scaffolded remotion/; fall back to the
  // skill template only for legacy projects without one.
  const projectEntry = resolve(projectDir, 'remotion', 'src', 'index.ts');
  const entryPoint = existsSync(projectEntry)
    ? projectEntry
    : resolve(__dirname, 'src', 'index.ts');
  const remotionRoot = dirname(dirname(entryPoint));
  const { bundle, renderMedia, selectComposition } = await loadRemotionTooling(remotionRoot);
  const concurrency = Math.max(1, Math.floor(cpus().length / 2));

  console.log(`Source tree: ${remotionRoot}`);
  console.log(`Bundling Remotion project...`);
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => {
      // Disable webpack cache to ensure fresh bundle picks up latest scene files
      config.cache = false;
      return config;
    },
  });
  // Each bundle copies the full public/ assets into a temp dir; repeated runs
  // fill the disk (hit ENOSPC in production). Always clean up on exit.
  process.on('exit', () => {
    try { rmSync(bundleLocation, { recursive: true, force: true }); } catch {}
  });

  const sceneFiles = [];

  const scenesToRender = sceneFilter
    ? project.scenes.filter(s => sceneFilter.has(s.id))
    : project.scenes;

  if (sceneFilter) {
    console.log(`Filtering to scene(s): ${[...sceneFilter].join(', ')}`);
  }

  for (let i = 0; i < scenesToRender.length; i++) {
    const scene = scenesToRender[i];
    const sceneOutput = join(scenesDir, `${scene.id}.mp4`);
    sceneFiles.push(sceneOutput);

    console.log(`\nRendering ${scene.id} (${scene.durationFrames} frames)...`);

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'RemoxScene',
      inputProps: {
        sceneId: scene.id,
        audioFile: scene.audio || '',
        durationInFrames: scene.durationFrames,
        width,
        height,
      },
    });

    const startTime = Date.now();
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: sceneOutput,
      inputProps: {
        sceneId: scene.id,
        audioFile: scene.audio || '',
        durationInFrames: scene.durationFrames,
        width,
        height,
      },
      concurrency,
      imageFormat: 'jpeg',
      jpegQuality: 90,
      timeoutInMilliseconds: 120000,
      onProgress: ({ progress }) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        process.stdout.write(`\r  ${scene.id}: ${(progress * 100).toFixed(1)}% | ${elapsed}s`);
      },
    });
    // Trim audio to exact video duration to prevent cumulative drift
    const exactDuration = (scene.durationFrames / fps).toFixed(6);
    const trimmedOutput = sceneOutput.replace('.mp4', '_trimmed.mp4');
    execSync(`ffmpeg -y -i "${sceneOutput}" -t ${exactDuration} -c:v copy -c:a aac -b:a 192k "${trimmedOutput}"`, { stdio: 'pipe' });
    execSync(`mv "${trimmedOutput}" "${sceneOutput}"`);

    console.log(`\n  ${scene.id} done (trimmed to ${exactDuration}s).`);
  }

  // FFmpeg concat
  const concatList = resolve(projectDir, 'output', 'concat.txt');
  if (sceneFiles.length > 1) {
    console.log(`\nConcatenating ${sceneFiles.length} scenes...`);
    const concatContent = sceneFiles.map(f => `file '${f}'`).join('\n');
    writeFileSync(concatList, concatContent);
    execSync(`ffmpeg -y -f concat -safe 0 -i "${concatList}" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 192k "${resolve(outputPath)}"`, { stdio: 'inherit' });
  } else if (sceneFiles.length === 1) {
    const src = resolve(sceneFiles[0]);
    const dst = resolve(outputPath);
    if (src !== dst) execSync(`cp "${src}" "${dst}"`);
  }

  console.log(`\nPer-scene MP4s preserved in: ${scenesDir}`);
  console.log(`Done: ${resolve(outputPath)}`);
}

main().catch((err) => {
  console.error('Render failed:', err);
  process.exit(1);
});
