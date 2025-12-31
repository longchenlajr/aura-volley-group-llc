export function Chip({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs tracking-[0.16em] uppercase",
        active
          ? "bg-[rgba(160,120,255,0.18)] text-white/85 ring-1 ring-[rgba(160,120,255,0.25)]"
          : "bg-white/[0.04] text-white/55 ring-1 ring-white/10",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
