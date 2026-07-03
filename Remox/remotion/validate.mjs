#!/usr/bin/env node
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

// Load Remotion tooling from the SAME tree as the source being bundled, so
// bundler/renderer/remotion versions always match.
async function loadRemotionTooling(remotionRoot) {
  const req = createRequire(join(remotionRoot, 'package.json'));
  const { bundle } = await import(pathToFileURL(req.resolve('@remotion/bundler')).href);
  const { renderStill, selectComposition } = await import(pathToFileURL(req.resolve('@remotion/renderer')).href);
  return { bundle, renderStill, selectComposition };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const auditMode = args.includes('--audit');
const projectPath = args.find(a => !a.startsWith('--'));

if (!projectPath) {
  console.error('Usage: node validate.mjs <project.json> [--audit]');
  process.exit(1);
}

const project = JSON.parse(readFileSync(resolve(projectPath), 'utf-8'));
const projectDir = project.projectDir ? resolve(project.projectDir) : dirname(resolve(projectPath));

// Project-relative output for stills (persistent)
const stillsDir = resolve(projectDir, 'output', 'stills');
if (!existsSync(stillsDir)) mkdirSync(stillsDir, { recursive: true });

function getAuditFrames(durationFrames) {
  return [0, 0.15, 0.25, 0.5, 0.75, 0.9].map(p => Math.round(durationFrames * p))
    .concat([durationFrames - 1]);
}

async function main() {
  // Source tree: prefer the project's scaffolded remotion/; fall back to the
  // skill template only for legacy projects without one.
  const projectEntry = resolve(projectDir, 'remotion', 'src', 'index.ts');
  const entryPoint = existsSync(projectEntry)
    ? projectEntry
    : resolve(__dirname, 'src', 'index.ts');
  const remotionRoot = dirname(dirname(entryPoint));
  const { bundle, renderStill, selectComposition } = await loadRemotionTooling(remotionRoot);
  console.log(`Source tree: ${remotionRoot}`);

  console.log(`Bundling for validation${auditMode ? ' (audit mode)' : ''}...`);
  const bundleLocation = await bundle({ entryPoint });
  // Bundles copy full public/ assets into temp; repeated runs fill the disk
  // (hit ENOSPC in production). Always clean up on exit.
  process.on('exit', () => {
    try { rmSync(bundleLocation, { recursive: true, force: true }); } catch {}
  });

  let passed = 0;
  let failed = 0;
  const errors = [];
  const auditReport = [];

  for (const scene of project.scenes) {
    const sceneLabel = auditMode ? `Auditing ${scene.id}` : `Validating ${scene.id}`;
    process.stdout.write(`  ${sceneLabel}...`);

    try {
      const composition = await selectComposition({
        serveUrl: bundleLocation,
        id: 'RemoxScene',
        inputProps: {
          sceneId: scene.id,
          audioFile: scene.audio || '',
          durationInFrames: scene.durationFrames,
        },
      });

      if (auditMode) {
        // Multi-frame audit: 7 keypoint frames per scene
        const sceneStillsDir = join(stillsDir, scene.id);
        if (!existsSync(sceneStillsDir)) mkdirSync(sceneStillsDir, { recursive: true });

        const frames = getAuditFrames(scene.durationFrames);
        const framePaths = [];

        for (const frame of frames) {
          const frameName = `${scene.id}_f${String(frame).padStart(4, '0')}.jpeg`;
          const framePath = join(sceneStillsDir, frameName);

          await renderStill({
            composition,
            serveUrl: bundleLocation,
            output: framePath,
            imageFormat: 'jpeg',
            inputProps: {
              sceneId: scene.id,
              audioFile: scene.audio || '',
              durationInFrames: scene.durationFrames,
            },
            frame,
          });
          framePaths.push(framePath);
        }

        auditReport.push({
          scene: scene.id,
          status: 'ok',
          frames: frames,
          paths: framePaths,
        });
        console.log(` OK (${frames.length} frames)`);
      } else {
        // Standard validation: frame 0 only
        await renderStill({
          composition,
          serveUrl: bundleLocation,
          output: join(stillsDir, `${scene.id}.jpeg`),
          imageFormat: 'jpeg',
          inputProps: {
            sceneId: scene.id,
            audioFile: scene.audio || '',
            durationInFrames: scene.durationFrames,
          },
          frame: 0,
        });
        console.log(' OK');
      }

      passed++;
    } catch (err) {
      console.log(` FAIL`);
      errors.push({ scene: scene.id, error: err.message });
      if (auditMode) {
        auditReport.push({
          scene: scene.id,
          status: 'fail',
          error: err.message,
        });
      }
      failed++;
    }
  }

  // Write audit report if in audit mode
  if (auditMode) {
    const reportPath = join(stillsDir, 'audit-report.json');
    writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      project: resolve(projectPath),
      mode: 'source-level-audit',
      scenes: auditReport,
      summary: { passed, failed, total: project.scenes.length },
    }, null, 2));
    console.log(`\nAudit report: ${reportPath}`);
  }

  console.log(`\nStills preserved in: ${stillsDir}`);
  console.log(`Validation: ${passed} passed, ${failed} failed`);

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  ${e.scene}: ${e.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});
