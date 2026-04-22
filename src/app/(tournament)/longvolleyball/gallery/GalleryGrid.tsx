"use client";

import { useEffect, useRef } from "react";

interface GalleryImage {
  src: string;
  thumb: string;
}

export function GalleryGrid({ images }: { images: GalleryImage[] }) {
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
      { rootMargin: "0px 0px -40px 0px", threshold: 0.05 },
    );

    const items = grid.querySelectorAll(".lv-masonry-item");
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [images]);

  return (
    <div className="lv-masonry" ref={gridRef}>
      {images.map((img, i) => (
        <div key={img.src} className="lv-masonry-item">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.thumb}
            alt={`Photo ${i + 1}`}
            loading={i < 12 ? "eager" : "lazy"}
          />
        </div>
      ))}
    </div>
  );
}
