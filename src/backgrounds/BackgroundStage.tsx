import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/theme';
import { GalaxyBackground } from './GalaxyBackground';
import { MatrixBackground } from './MatrixBackground';
import { RainbowBackground } from './RainbowBackground';
import { KittyBackground } from './KittyBackground';

/**
 * Crossfade duration. Must match the `bg-crossfade-enter` keyframe in index.css:
 * the incoming layer fades in over this window, after which the outgoing layers
 * are garbage-collected.
 */
const CROSSFADE_MS = 500;

function backgroundFor(theme: Theme): ReactElement {
  switch (theme) {
    case 'matrix':
      return <MatrixBackground />;
    case 'rainbow':
      return <RainbowBackground />;
    case 'kitty':
      return <KittyBackground />;
    default:
      return <GalaxyBackground />;
  }
}

/** One stacked background instance; `id` keeps React reconciliation stable. */
interface Layer {
  theme: Theme;
  id: number;
  /** True for layers added after mount, which animate their crossfade-in. */
  enter: boolean;
}

/**
 * Renders the active theme's background and crossfades between them on change.
 * On a theme switch the incoming background is stacked on top of the outgoing
 * one and fades in (a cross-dissolve — user-initiated motion, so it's kept even
 * under reduced-motion per the spec); once it's opaque the stale layers are
 * dropped so only one canvas/element stays mounted at rest. Each layer keeps its
 * own `fixed inset-0 -z-10`, so the ripple canvas (z-0) and content (z-10) still
 * sit above. The whole stage is `aria-hidden` — pure decoration.
 */
export function BackgroundStage() {
  const { theme } = useTheme();
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>(() => [{ theme, id: 0, enter: false }]);

  // Stack the new background on top whenever the theme changes.
  useEffect(() => {
    setLayers((cur) => {
      if (cur[cur.length - 1].theme === theme) return cur;
      return [...cur, { theme, id: nextId.current++, enter: true }];
    });
  }, [theme]);

  // Once the crossfade finishes, keep only the top (now fully-opaque) layer.
  useEffect(() => {
    if (layers.length <= 1) return;
    const timer = setTimeout(() => setLayers((cur) => cur.slice(-1)), CROSSFADE_MS);
    return () => clearTimeout(timer);
  }, [layers]);

  return (
    <div aria-hidden="true">
      {layers.map((layer, i) => {
        const isTop = i === layers.length - 1;
        return (
          <div
            key={layer.id}
            className={`fixed inset-0 -z-10${isTop && layer.enter ? ' bg-crossfade-enter' : ''}`}
          >
            {backgroundFor(layer.theme)}
          </div>
        );
      })}
    </div>
  );
}
