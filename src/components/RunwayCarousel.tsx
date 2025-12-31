"use client";

import Image from "next/image";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Player = {
  id: string | number;
  slug: string;
  name: string;
  role?: string;
};

const VISIBLE = 5; // must be odd (centered)
const CENTER = Math.floor(VISIBLE / 2); // 2

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export default function RunwayCarousel({ players }: { players: Player[] }) {
  const router = useRouter();
  const list = useMemo(() => players ?? [], [players]);

  // selected is the "center" player index in the full list
  // start with 0 as center
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    // reset if players change
    setSelected(0);
  }, [list.length]);

  // build the 5-card window around the selected index (looping)
  const windowPlayers = useMemo(() => {
    if (!list.length) return [];

    const res: { p: Player; idx: number }[] = [];

    for (let i = 0; i < VISIBLE; i++) {
      const offset = i - CENTER; // -2,-1,0,+1,+2
      const idx = mod(selected + offset, list.length);
      res.push({ p: list[idx], idx });
    }

    return res;
  }, [list, selected]);

  function goPrev() {
    if (!list.length) return;
    setSelected((s) => mod(s - 1, list.length));
  }

  function goNext() {
    if (!list.length) return;
    setSelected((s) => mod(s + 1, list.length));
  }

  // keyboard support
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Enter") {
        const center = windowPlayers[CENTER];
        if (center) router.push(`/team/${center.p.slug}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowPlayers]);

  // click behavior:
  // - if clicked card is not selected => select it
  // - if clicked card IS selected => navigate
  function onCardClick(
    e: React.MouseEvent,
    idxInFullList: number,
    slug: string
  ) {
    e.preventDefault();

    if (idxInFullList !== selected) {
      setSelected(idxInFullList);
      return;
    }

    router.push(`/team/${slug}`);
  }

  const center = windowPlayers[CENTER]?.p;

  return (
    <div className="runway" aria-label="Team runway carousel">
      {/* edge arrows */}
      <div className="runway-edge">
        <button
          className="runway-edge-btn left"
          onClick={goPrev}
          aria-label="Previous"
        >
          <span className="runway-edge-icon">←</span>
        </button>
        <button
          className="runway-edge-btn right"
          onClick={goNext}
          aria-label="Next"
        >
          <span className="runway-edge-icon">→</span>
        </button>
      </div>

      {/* 5-up rail */}
      <div className="runway-rail">
        {windowPlayers.map(({ p, idx }, slot) => {
          const isActive = slot === CENTER;

          return (
            <a
              key={`${p.id}-${idx}-${slot}`}
              href={`/team/${p.slug}`}
              className={`runway-card ${isActive ? "is-active" : ""}`}
              onClick={(e) => onCardClick(e, idx, p.slug)}
              aria-current={isActive ? "true" : "false"}
            >
              <div className="runway-photo">
                <Image
                  src={`/img/players/${p.slug}.png`}
                  alt={p.name}
                  fill
                  sizes="(max-width: 900px) 33vw, 20vw"
                  style={{ objectFit: "cover" }}
                  priority={isActive}
                />
              </div>

              {/* meta only for center */}
              <div className="runway-meta">
                <div className="runway-role">{p.role ?? "Player"}</div>
                <div className="runway-name">{p.name}</div>
              </div>
            </a>
          );
        })}
      </div>

      {/* Optional: fixed selected readout (hidden) */}
      {center ? (
        <div style={{ display: "none" }}>Selected: {center.name}</div>
      ) : null}
    </div>
  );
}
