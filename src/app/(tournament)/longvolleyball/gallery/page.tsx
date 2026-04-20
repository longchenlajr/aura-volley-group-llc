"use client";

import { useEffect, useRef } from "react";
import { DecorativeAsset } from "../../DecorativeAsset";

// 50 placeholder images with varied aspect ratios
// Using picsum.photos with fixed seeds for consistent results
const PHOTOS = [
  { w: 600, h: 400, seed: 10 },  // landscape
  { w: 400, h: 600, seed: 11 },  // portrait
  { w: 600, h: 600, seed: 12 },  // square
  { w: 600, h: 350, seed: 13 },  // wide
  { w: 400, h: 550, seed: 14 },  // tall
  { w: 600, h: 400, seed: 15 },
  { w: 500, h: 700, seed: 16 },  // tall portrait
  { w: 600, h: 400, seed: 17 },
  { w: 400, h: 400, seed: 18 },  // square
  { w: 600, h: 350, seed: 19 },  // wide
  { w: 400, h: 600, seed: 20 },
  { w: 600, h: 450, seed: 21 },
  { w: 500, h: 500, seed: 22 },
  { w: 600, h: 380, seed: 23 },
  { w: 400, h: 560, seed: 24 },
  { w: 600, h: 400, seed: 25 },
  { w: 400, h: 600, seed: 26 },
  { w: 600, h: 600, seed: 27 },
  { w: 600, h: 340, seed: 28 },  // panoramic
  { w: 400, h: 500, seed: 29 },
  { w: 600, h: 420, seed: 30 },
  { w: 500, h: 700, seed: 31 },
  { w: 600, h: 400, seed: 32 },
  { w: 400, h: 400, seed: 33 },
  { w: 600, h: 500, seed: 34 },
  { w: 400, h: 600, seed: 35 },
  { w: 600, h: 360, seed: 36 },
  { w: 500, h: 650, seed: 37 },
  { w: 600, h: 400, seed: 38 },
  { w: 600, h: 600, seed: 39 },
  { w: 400, h: 550, seed: 40 },
  { w: 600, h: 400, seed: 41 },
  { w: 600, h: 450, seed: 42 },
  { w: 400, h: 600, seed: 43 },
  { w: 600, h: 380, seed: 44 },
  { w: 500, h: 500, seed: 45 },
  { w: 600, h: 400, seed: 46 },
  { w: 400, h: 700, seed: 47 },  // very tall
  { w: 600, h: 350, seed: 48 },
  { w: 600, h: 600, seed: 49 },
  { w: 400, h: 500, seed: 50 },
  { w: 600, h: 400, seed: 51 },
  { w: 500, h: 650, seed: 52 },
  { w: 600, h: 420, seed: 53 },
  { w: 400, h: 400, seed: 54 },
  { w: 600, h: 500, seed: 55 },
  { w: 400, h: 600, seed: 56 },
  { w: 600, h: 360, seed: 57 },
  { w: 500, h: 500, seed: 58 },
  { w: 600, h: 400, seed: 59 },
];

export default function GalleryPage() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -60px 0px", threshold: 0.1 },
    );

    const items = grid.querySelectorAll(".lv-masonry-item");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="lv-gallery-page">
      <div className="lv-container">
        <div className="lv-gallery-header">
          <div style={{ marginBottom: "1.5rem" }}>
            <DecorativeAsset src="divider.png" className="lv-divider-img" width={280} height={24} />
          </div>
          <h1 className="lv-h1">Gallery</h1>
        </div>

        <div className="lv-masonry" ref={gridRef}>
          {PHOTOS.map((photo, i) => (
            <div key={i} className="lv-masonry-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://picsum.photos/seed/lv${photo.seed}/${photo.w}/${photo.h}`}
                alt={`Tournament photo ${i + 1}`}
                width={photo.w}
                height={photo.h}
                loading="lazy"
                style={{ aspectRatio: `${photo.w}/${photo.h}` }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
