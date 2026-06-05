type Props = {
  name: string;
  section?: string | null;
  bannerColor: string;
};

export function ClassBanner({ name, section, bannerColor }: Props) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-9 text-white shadow-card sm:px-8 sm:py-11"
      style={{
        backgroundImage: `linear-gradient(135deg, ${bannerColor} 0%, ${bannerColor}cc 55%, ${bannerColor}99 100%)`,
      }}
    >
      {/* Soft decorative orbs for depth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-black/10 blur-2xl"
      />
      <div className="relative">
        <h1 className="font-display text-3xl font-semibold tracking-tight drop-shadow-sm sm:text-4xl">
          {name}
        </h1>
        {section && (
          <p className="mt-1.5 text-sm font-medium text-white/85 sm:text-base">
            {section}
          </p>
        )}
      </div>
    </div>
  );
}
