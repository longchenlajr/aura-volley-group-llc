import fs from "fs";
import path from "path";
import { SectionDivider } from "../../ornaments";
import { GalleryGrid } from "./GalleryGrid";

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


export default function GalleryPage() {
  const allImages = getImages("longvolleyball/gallery", "/longvolleyball/gallery");

  return (
    <div className="lv-gallery-page">
      {/* Header — stays inside container */}
      <div className="lv-container">
        <div className="lv-live-header">
          <p className="lv-label" style={{ color: "var(--lv-red)", marginBottom: "0.5rem" }}>
            Gallery
          </p>
          <h1
            className="lv-h1"
            style={{
              fontSize: "clamp(2.5rem, 8vw, 4.5rem)",
              fontWeight: 900,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Photo Book
          </h1>
          <p
            style={{
              fontFamily: "var(--lv-font-body)",
              fontSize: "0.6rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "var(--lv-gold)",
              opacity: 0.8,
              marginTop: "0.875rem",
            }}
          >
            The court remembers.
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
