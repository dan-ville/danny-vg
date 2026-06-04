import { useState } from 'react';
import { ProfileHeader } from './components/ProfileHeader';
import { LinkCard } from './components/LinkCard';
import { ThemeOrb } from './components/ThemeOrb';
import { MotionToggle } from './components/MotionToggle';
import { VisibilityToggle } from './components/VisibilityToggle';
import { BackgroundStage } from './backgrounds/BackgroundStage';
import { EffectStage } from './effects/EffectStage';
import { ThemeCursor } from './effects/ThemeCursor';
import { links } from './data/links';

export default function App() {
  // Mobile immersive mode: hide the profile, links, and motion toggle so the
  // visitor can play with the live theme unobstructed. Desktop ignores this —
  // every concealable element re-asserts visibility at `lg:`.
  const [hidden, setHidden] = useState(false);

  return (
    <>
      <BackgroundStage />
      <EffectStage />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-8 px-6 py-16">
        <ProfileHeader name="Danny VG" initials="DV" hidden={hidden} />
        <nav
          aria-hidden={hidden || undefined}
          className={`concealable flex w-full flex-col gap-3${hidden ? ' concealable--off' : ''}`}
        >
          {links.map((link) => (
            <LinkCard key={link.label} label={link.label} href={link.href} icon={link.icon} />
          ))}
        </nav>
      </main>
      {/* Corner controls in keyboard tab order: motion → visibility → orb. */}
      <MotionToggle hidden={hidden} />
      <VisibilityToggle hidden={hidden} onToggle={() => setHidden((h) => !h)} />
      <ThemeOrb />
      <ThemeCursor />
    </>
  );
}
