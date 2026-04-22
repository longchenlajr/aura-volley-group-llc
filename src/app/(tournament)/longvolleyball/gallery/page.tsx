import fs from "fs";
import path from "path";
import { SectionDivider } from "../../ornaments";
import { GalleryGrid } from "./GalleryGrid";

export const dynamic = "force-dynamic";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

interface GalleryImage {
  src: string;
  thumb: string;
}

function getImages(dir: string, urlBase: string): GalleryImage[] {
  const fullPath = path.join(process.cwd(), "public", dir);
  try {
    return fs
      .readdirSync(fullPath)
      .filter((f) => {
        const ext = path.extname(f).toLowerCase();
        return IMAGE_EXTENSIONS.has(ext) && !f.startsWith(".");
      })
      .filter((f) => !fs.statSync(path.join(fullPath, f)).isDirectory())
      .sort()
      .map((f) => {
        const baseName = path.parse(f).name;
        return {
          src: `${urlBase}/${f}`,
          thumb: `${urlBase}/thumbs/${baseName}.webp`,
        };
      });
  } catch {
    return [];
  }
}

/** Interleave two arrays so images from each source are spread evenly */
function interleave(a: GalleryImage[], b: GalleryImage[]): GalleryImage[] {
  const result: GalleryImage[] = [];
  const long = a.length >= b.length ? a : b;
  const short = a.length >= b.length ? b : a;
  if (short.length === 0) return long;

  const ratio = long.length / short.length;
  let si = 0;
  for (let li = 0; li < long.length; li++) {
    result.push(long[li]);
    // Insert a short item at evenly spaced intervals
    if (si < short.length && li >= Math.round((si + 1) * ratio) - 1) {
      result.push(short[si]);
      si++;
    }
  }
  // Push any remaining
  while (si < short.length) {
    result.push(short[si++]);
  }
  return result;
}

export default function GalleryPage() {
  const champions = getImages("longvolleyball/champions", "/longvolleyball/champions");
  const gallery = getImages("longvolleyball/gallery", "/longvolleyball/gallery");
  const allImages = interleave(gallery, champions);

  return (
    <div className="lv-gallery-page">
      {/* Header — stays inside container */}
      <div className="lv-container">
        <div className="lv-live-header">
          <p
            className="lv-label"
            style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}
          >
            Gallery
          </p>
          <h1 className="lv-h1">Photo Book</h1>
          <p
            style={{
              color: "var(--lv-ink-muted)",
              fontSize: "0.95rem",
              marginTop: "0.5rem",
            }}
          >
            Memories captured over the years.
          </p>
          <div style={{ marginTop: "1.5rem" }}>
            <SectionDivider
              className="lv-section-divider"
              style={{ color: "var(--lv-gold)", opacity: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* All photos — edge-to-edge masonry */}
      {allImages.length > 0 ? (
        <GalleryGrid images={allImages} />
      ) : (
        <div className="lv-container">
          <p className="lv-gallery-empty">
            Photos coming soon — check back after the first tournament.
          </p>
        </div>
      )}
    </div>
  );
}
