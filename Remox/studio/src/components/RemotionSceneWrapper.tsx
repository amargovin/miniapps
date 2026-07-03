/**
 * RemotionSceneWrapper
 *
 * Dynamically loads a scene TSX component by scene ID and renders it
 * inside the Remotion <Player>.
 *
 * Vite import strategy:
 * 1. Primary: import.meta.glob over the project scenes directory.
 *    The glob key is resolved via the @project/scenes alias configured in vite.config.ts.
 * 2. The glob gives Vite a static set of files it can discover at dev-server start.
 *    Each file is loaded lazily via the { eager: false } default.
 *
 * Why glob over direct dynamic import:
 * - Vite requires static analysis of dynamic import() expressions to build
 *   the module graph. A string template with a variable breaks this.
 * - import.meta.glob with a literal pattern gives Vite the full module map
 *   at compile time; we then select the right one at runtime.
 */

import React, { Suspense, lazy, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';

// Props passed via Player's `inputProps`
export interface RemotionSceneWrapperProps {
  sceneId: string; // e.g. "Scene01", "Scene02", "Scene_01"
}

// ---------------------------------------------------------------------------
// Glob import — Vite resolves @project/scenes at dev time via the alias.
// The pattern must be a string literal for Vite's static analysis.
// ---------------------------------------------------------------------------
const sceneModules = import.meta.glob('@project/scenes/Scene_*.tsx');

// Cache of lazy-loaded components keyed by filename ("Scene_01")
const lazyCache: Record<string, React.LazyExoticComponent<React.ComponentType>> = {};

/**
 * Normalise a scene ID to the filename format used in the glob map.
 * "Scene01" | "Scene_01" | "scene01" → "Scene_01"
 */
function normaliseToFilename(sceneId: string): string {
  const match = sceneId.match(/^[Ss]cene_?(\d+)$/);
  if (!match) return sceneId;
  const num = match[1].padStart(2, '0');
  return `Scene_${num}`;
}

/**
 * Find the glob key that corresponds to this scene filename.
 * The keys look like "@project/scenes/Scene_01.tsx" (alias is expanded by Vite
 * during the glob resolution — but in the key map Vite may store the real path).
 * We match by filename suffix to be robust.
 */
function findGlobKey(filename: string): string | undefined {
  return Object.keys(sceneModules).find(k => k.includes(`/${filename}.tsx`) || k.endsWith(`${filename}.tsx`));
}

/**
 * Returns a React.lazy component for the given scene ID.
 */
function getLazyScene(sceneId: string): React.LazyExoticComponent<React.ComponentType> {
  const filename = normaliseToFilename(sceneId);

  if (!lazyCache[filename]) {
    const globKey = findGlobKey(filename);

    if (globKey) {
      // Use the glob loader — returns () => Promise<Module>
      const loader = sceneModules[globKey] as () => Promise<{ default: React.ComponentType }>;
      lazyCache[filename] = lazy(() =>
        loader().catch((err) => {
          console.error(`[RemotionSceneWrapper] Failed to load ${filename} via glob:`, err);
          return { default: makeErrorComponent(filename, err) };
        })
      );
    } else {
      // Fallback: no matching glob key found — render an informative error
      console.warn(
        `[RemotionSceneWrapper] No glob entry for "${filename}". ` +
        `Available keys:`, Object.keys(sceneModules)
      );
      const Fallback = makeErrorComponent(
        filename,
        new Error(`Scene file not found in glob. Check @project/scenes alias in vite.config.ts.`)
      );
      lazyCache[filename] = lazy(() => Promise.resolve({ default: Fallback }));
    }
  }

  return lazyCache[filename];
}

/** Creates a simple error display component */
function makeErrorComponent(filename: string, err: Error): React.ComponentType {
  return function SceneErrorBoundary() {
    return (
      <AbsoluteFill
        style={{
          background: '#0a0a14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          padding: 48,
        }}
      >
        <div style={{ color: '#ef4444', fontSize: 22, fontFamily: 'monospace', fontWeight: 700 }}>
          Failed to load {filename}
        </div>
        <div style={{
          color: '#6b7280',
          fontSize: 13,
          fontFamily: 'monospace',
          textAlign: 'center',
          maxWidth: 800,
          lineHeight: 1.6,
        }}>
          {err?.message ?? 'Module resolution error'}
        </div>
        <div style={{ color: '#374151', fontSize: 12, fontFamily: 'monospace', marginTop: 8 }}>
          Check that REMOX_PROJECT_DIR is set and vite.config.ts has the correct aliases.
        </div>
      </AbsoluteFill>
    );
  };
}

/** Loading spinner shown while the scene module is being fetched */
function SceneLoadingFallback({ sceneId }: { sceneId: string }) {
  return (
    <AbsoluteFill
      style={{
        background: '#0a0a14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        border: '3px solid #1e3a5f',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'remox-spin 0.8s linear infinite',
      }} />
      <div style={{ color: '#6b7280', fontSize: 14, fontFamily: 'monospace' }}>
        Loading {sceneId}...
      </div>
      <style>{`@keyframes remox-spin { to { transform: rotate(360deg); } }`}</style>
    </AbsoluteFill>
  );
}

/**
 * The wrapper component used as the Remotion Player's `component` prop.
 * Receives `inputProps` from the Player and dynamically loads the scene.
 */
export const RemotionSceneWrapper: React.FC<RemotionSceneWrapperProps> = ({ sceneId }) => {
  const SceneComp = useMemo(() => getLazyScene(sceneId), [sceneId]);

  return (
    <Suspense fallback={<SceneLoadingFallback sceneId={sceneId} />}>
      <SceneComp />
    </Suspense>
  );
};

export default RemotionSceneWrapper;
