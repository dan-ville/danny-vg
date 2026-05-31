export interface ProfileHeaderProps {
  name: string;
  initials: string;
  /** Optional real photo dropped into /public; falls back to initials placeholder. */
  photoSrc?: string;
}

/**
 * Avatar with a slowly-rotating gradient accent ring (static under
 * reduced-motion via CSS), initials placeholder inside, and the display
 * name below.
 */
export function ProfileHeader({ name, initials, photoSrc }: ProfileHeaderProps) {
  return (
    <header className="flex flex-col items-center gap-4">
      <div className="profile-ring">
        <div className="profile-ring__inner">
          {photoSrc ? (
            <img src={photoSrc} alt={name} className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-2xl font-bold tracking-wide">{initials}</span>
          )}
        </div>
      </div>
      <h1 className="font-[Space_Grotesk] text-2xl font-bold tracking-tight">{name}</h1>
    </header>
  );
}
