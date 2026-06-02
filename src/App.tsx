import { ProfileHeader } from './components/ProfileHeader';
import { LinkCard } from './components/LinkCard';
import { ThemeOrb } from './components/ThemeOrb';
import { MotionToggle } from './components/MotionToggle';
import { BackgroundStage } from './backgrounds/BackgroundStage';
import { EffectStage } from './effects/EffectStage';
import { ThemeCursor } from './effects/ThemeCursor';
import { links } from './data/links';

export default function App() {
  return (
    <>
      <BackgroundStage />
      <EffectStage />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-8 px-6 py-16">
        <ProfileHeader name="Danny VG" initials="DV" />
        <nav className="flex w-full flex-col gap-3">
          {links.map((link) => (
            <LinkCard key={link.label} label={link.label} href={link.href} icon={link.icon} />
          ))}
        </nav>
      </main>
      {/* Corner controls in keyboard tab order: motion → orb. */}
      <MotionToggle />
      <ThemeOrb />
      <ThemeCursor />
    </>
  );
}
