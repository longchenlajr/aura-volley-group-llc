import fs from "fs";
import path from "path";
import { SectionDivider } from "../../ornaments";
import { GalleryGrid } from "./GalleryGrid";

export const dynamic = "force-dynamic";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);

function getImages(dir: string, urlBase: string): string[] {
  const fullPath = path.join(process.cwd(), "public", dir);
  try {
    return fs
      .readdirSync(fullPath)
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .sort()
      .map((f) => `${urlBase}/${f}`);
  } catch {
    return [];
  }
}

export default function GalleryPage() {
  const champions = getImages("longvolleyball/champions", "/longvolleyball/champions");
  const gallery = getImages("longvolleyball/gallery", "/longvolleyball/gallery");

  return (
    <div className="lv-gallery-page">
      <div className="lv-container">
        {/* Header */}
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

        {champions.length > 0 ? (
          <GalleryGrid images={champions} />
        ) : (
          <p className="lv-gallery-empty">
            Photos coming soon — check back after the first tournament.
          </p>
        )}

        {/* Gallery */}
        <div className="lv-live-header" style={{ marginTop: "4rem" }}>
          {/* <p className="lv-label" style={{ color: "var(--lv-gold)", marginBottom: "0.5rem" }}>Moments</p>
          <h1 className="lv-h1">Gallery</h1>
          <div style={{ marginTop: "1.5rem" }}>
            <SectionDivider className="lv-section-divider" style={{ color: "var(--lv-gold)", opacity: 0.5 }} />
          </div> */}
        </div>

        {gallery.length > 0 ? (
          <GalleryGrid images={gallery} />
        ) : (
          <p className="lv-gallery-empty">
            Photos coming soon — check back after the first tournament.
          </p>
        )}
      </div>
    </div>
  );
}
