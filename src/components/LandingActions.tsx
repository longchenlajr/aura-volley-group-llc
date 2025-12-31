"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Item = { href: string; kicker: string; title: string };

export default function LandingActions({
  dropName,
  dropHref,
}: {
  dropName: string;
  dropHref: string;
}) {
  const items: Item[] = useMemo(
    () => [
      { href: "/team", kicker: "Explore", title: "Meet the Team" },
      { href: "/store", kicker: "Enter", title: "Store" },
      { href: dropHref, kicker: "Upcoming", title: dropName },
    ],
    [dropHref, dropName]
  );

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [x, setX] = useState(0);
  const [w, setW] = useState(110);

  function moveToIndex(i: number) {
    const root = rootRef.current;
    if (!root) return;

    const el = root.querySelectorAll<HTMLAnchorElement>("[data-action]")[i];
    if (!el) return;

    const rootRect = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();

    // Track the top label width (kicker) so it stays visually balanced.
    const label = el.querySelector<HTMLElement>("[data-label]");
    const lr = label?.getBoundingClientRect();
    const targetW = Math.max(80, Math.min(150, (lr?.width ?? r.width) + 18));

    const targetX = r.left - rootRect.left + r.width / 2 - targetW / 2;

    setW(targetW);
    setX(targetX);
  }

  useEffect(() => {
    moveToIndex(1);
    const onResize = () => moveToIndex(1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={rootRef}
      className="landing-actions"
      style={{ ["--x" as any]: `${x}px`, ["--w" as any]: `${w}px` }}
      onMouseLeave={() => moveToIndex(1)}
    >
      <div className="aura-underline" />

      {items.map((it, i) => (
        <Link
          key={it.href}
          href={it.href}
          data-action
          className={`landing-action ${i === 1 ? "center" : "side"}`}
          onMouseEnter={() => moveToIndex(i)}
          onFocus={() => moveToIndex(i)}
        >
          <span className="k" data-label>
            {it.kicker}
          </span>
          <span className="t">{it.title}</span>
        </Link>
      ))}
    </div>
  );
}
