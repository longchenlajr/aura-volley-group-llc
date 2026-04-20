"use client";

import { useEffect, useRef } from "react";

export function GalleryGrid({ images }: { images: string[] }) {
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
  }, [images]);

  return (
    <div className="lv-masonry" ref={gridRef}>
      {images.map((src, i) => (
        <div key={src} className="lv-masonry-item">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Photo ${i + 1}`}
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
