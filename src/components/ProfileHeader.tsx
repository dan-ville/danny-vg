export interface ProfileHeaderProps {
  name: string;
  initials: string;
  /** Optional real photo dropped into /public; falls back to initials placeholder. */
  photoSrc?: string;
  /**
   * Mobile immersive mode: when true the header fades out + ignores pointers so
   * the user can admire the bare theme. Always overridden visible at `lg:`.
   */
  hidden?: boolean;
}

/**
 * Avatar with a slowly-rotating gradient accent ring (static under
 * reduced-motion via CSS), initials placeholder inside, and the display name.
 *
 * Two layouts share one markup via responsive classes:
 *   - **mobile (base):** a fixed top-left bar — a smaller ring with the name
 *     beside it — leaving the centered column for the links alone.
 *   - **desktop (`lg:`):** the original static, stacked, centered header.
 */
export function ProfileHeader({ name, initials, photoSrc, hidden = false }: ProfileHeaderProps) {
  return (
    <header
      aria-hidden={hidden || undefined}
      className={`concealable fixed left-4 top-4 z-20 flex flex-row items-center gap-3 lg:static lg:flex-col lg:gap-4${
        hidden ? ' concealable--off' : ''
      }`}
    >
      <div className="profile-ring">
        <div className="profile-ring__inner">
          {photoSrc ? (
            <img src={photoSrc} alt={name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-lg font-bold tracking-wide lg:text-2xl">{initials}</span>
          )}
        </div>
      </div>
      <h1 className="font-[Space_Grotesk] text-xl font-bold tracking-tight lg:text-2xl">{name}</h1>
    </header>
  );
}
