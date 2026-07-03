# Delay Render

Remotion renders each frame synchronously by default. `delayRender()` pauses rendering until you call `continueRender()` — giving you a window to perform async work (loading fonts, fetching data, decoding images) before the first frame is drawn.

Without this, custom fonts won't be available on frame 0, fetched data won't exist, and loaded images will be blank.

---

## Core API

```ts
import { delayRender, continueRender } from 'remotion';

// Call once to get a handle — rendering pauses immediately
const handle = delayRender('Loading custom font');

// Do your async work...
await loadSomething();

// Release the hold — rendering resumes
continueRender(handle);
```

The string passed to `delayRender()` is a label that appears in Remotion Studio's loading UI and error messages. Always provide a descriptive label.

---

## Rules

1. Call `delayRender()` **before** the async work begins.
2. Always call `continueRender(handle)` in a `finally` block to avoid hanging renders.
3. Do not call `delayRender()` inside a loop — batch your async work into a single handle per concern.
4. Multiple handles are fine — rendering waits for all of them.
5. Timeout: Remotion will error if `continueRender` is not called within 30 seconds by default. Configurable via `remotion.config.ts`.

---

## Pattern: Google Fonts Loading

The most common use case. Google Fonts are loaded via CSS `@import` and require the font to be fully parsed before frame 0.

```tsx
import { useEffect, useRef } from 'react';
import { delayRender, continueRender, AbsoluteFill } from 'remotion';
import { FONTS, PALETTE } from '../theme';

// Reusable font-loading wrapper
export function useFontLoader(fontFamily: string, googleFontUrl: string) {
  const handle = useRef<number | null>(null);

  useEffect(() => {
    // Create handle before async work
    handle.current = delayRender(`Loading font: ${fontFamily}`);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = googleFontUrl;

    link.onload = () => {
      // Font CSS loaded — wait for the font itself to be ready
      document.fonts.ready.then(() => {
        if (handle.current !== null) {
          continueRender(handle.current);
        }
      });
    };

    link.onerror = () => {
      // Always release even on error — don't hang the render
      if (handle.current !== null) {
        continueRender(handle.current);
      }
    };

    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, [fontFamily, googleFontUrl]);
}
```

---

## Full Example: Font Loading Component Wrapper

A wrapper component that loads a Google Font before rendering its children. Wrap any scene that uses a custom font with this.

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
  spring,
} from 'remotion';
import { PALETTE, FONTS, MOTION } from '../theme';

// --- Font loader hook ---
function useGoogleFont(family: string, weights: number[] = [400, 700]) {
  const handle = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    handle.current = delayRender(`Loading Google Font: ${family}`);

    const weightParam = weights.join(';');
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weightParam}&display=block`;

    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = url;

    const release = () => {
      if (handle.current !== null) {
        continueRender(handle.current);
        handle.current = null;
        setLoaded(true);
      }
    };

    link.addEventListener('load', () => {
      // Ensure font bytes are decoded, not just CSS parsed
      document.fonts.ready.then(release).catch(release);
    });

    link.addEventListener('error', release);

    document.head.appendChild(link);

    return () => {
      // Cleanup on unmount (won't affect renders already in progress)
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, [family, weightParam]);

  return loaded;
}

// --- Scene using the hook ---
export default function CustomFontScene() {
  const frame       = useCurrentFrame();
  const { fps }     = useVideoConfig();

  // Load Inter before any frame renders
  const fontReady = useGoogleFont('Inter', [400, 700, 900]);

  const titleOpacity = spring({
    frame,
    fps,
    config: MOTION.snappy,
    from: 0,
    to: 1,
  });

  const titleY = spring({
    frame,
    fps,
    config: MOTION.heavy,
    from: 60,
    to: 0,
  });

  return (
    <AbsoluteFill
      style={{
        background: PALETTE.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {fontReady && (
        <h1
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 900,
            fontSize: 96,
            color: PALETTE.primary,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            letterSpacing: '-2px',
          }}
        >
          Custom Font Loaded
        </h1>
      )}
    </AbsoluteFill>
  );
}
```

---

## Pattern: Async Data Fetch

For scenes that need external data (API, JSON file):

```tsx
import { useEffect, useRef, useState } from 'react';
import { delayRender, continueRender } from 'remotion';

function useAsyncData<T>(url: string) {
  const handle = useRef<number | null>(null);
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    handle.current = delayRender(`Fetching: ${url}`);

    fetch(url)
      .then((res) => res.json())
      .then((json: T) => {
        setData(json);
      })
      .catch((err) => {
        console.error('delayRender fetch failed:', err);
      })
      .finally(() => {
        if (handle.current !== null) {
          continueRender(handle.current);
          handle.current = null;
        }
      });
  }, [url]);

  return data;
}
```

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Calling `delayRender` without ever calling `continueRender` | Use `finally` block |
| Calling `delayRender` inside the render function body (not `useEffect`) | Always inside `useEffect` |
| Calling `continueRender` with a stale handle | Store handle in `useRef`, not `useState` |
| No error handling on font load | Add `.addEventListener('error', release)` |
| Loading fonts on every render | Use `useEffect` with stable dependency array |
