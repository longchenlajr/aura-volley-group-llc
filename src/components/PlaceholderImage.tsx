export default function PlaceholderImage({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-[28px] bg-[rgb(var(--panel))] aura-ring">
      <div className="relative aspect-[16/10]">
        {/* soft aura haze */}
        <div className="absolute -top-28 left-10 h-72 w-72 rounded-full bg-[rgba(160,120,255,0.10)] blur-3xl" />
        <div className="absolute top-10 right-0 h-72 w-72 rounded-full bg-white/5 blur-3xl" />

        {/* “studio” light */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] via-transparent to-black/40" />

        {/* subtle vertical grain lines (architectural) */}
        <div className="absolute inset-0 opacity-[0.08] [background:repeating-linear-gradient(90deg,rgba(255,255,255,0.35)_0px,rgba(255,255,255,0.35)_1px,transparent_1px,transparent_28px)]" />

        {/* label */}
        <div className="absolute inset-x-0 bottom-0 p-7">
          <div className="kicker">{subtitle ?? "Spring26"}</div>
          <div className="mt-2 text-xl font-medium tracking-tight text-white/90">
            {title}
          </div>
          <div className="mt-5 h-px w-16 bg-[rgba(160,120,255,0.28)]" />
        </div>
      </div>
    </div>
  );
}
