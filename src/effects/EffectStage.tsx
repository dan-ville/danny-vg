import { useTheme } from '../context/ThemeContext';
import { RippleCanvas } from './RippleCanvas';

/**
 * Per-theme tap-effect dispatcher. Each theme owns its own background
 * interaction, so this picks the right one for the active theme rather than
 * running a single effect everywhere:
 *
 * - **galaxy** → no layer here; its tap interaction is the gravity well, which
 *   lives inside `GalaxyBackground` because it has to bend the real star field.
 * - **matrix / rainbow** → the water ripple, until they grow their own effects.
 *
 * Rendering `null` for galaxy unmounts the ripple's window listener, so a galaxy
 * tap only triggers the well — never both.
 */
export function EffectStage() {
  const { theme } = useTheme();
  if (theme === 'galaxy') return null;
  return <RippleCanvas />;
}
