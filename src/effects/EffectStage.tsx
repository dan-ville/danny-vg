import { useTheme } from '../context/ThemeContext';
import { RippleCanvas } from './RippleCanvas';

/**
 * Per-theme tap-effect dispatcher. Each theme owns its own background
 * interaction, so this picks the right one for the active theme rather than
 * running a single effect everywhere:
 *
 * - **galaxy** → no layer here; its tap interaction is the gravity well, which
 *   lives inside `GalaxyBackground` because it has to bend the real star field.
 * - **matrix** → no layer here either; its tap interaction is the vortex twist,
 *   which lives inside `MatrixBackground` because it has to warp the real rain.
 * - **rainbow** → the water ripple.
 *
 * Rendering `null` for galaxy and matrix unmounts the ripple's window listener,
 * so a tap on those themes only triggers their own background effect.
 */
export function EffectStage() {
  const { theme } = useTheme();
  if (theme === 'galaxy' || theme === 'matrix') return null;
  return <RippleCanvas />;
}
