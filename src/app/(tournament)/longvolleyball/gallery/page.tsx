import fs from "fs";
import path from "path";
import { DecorativeAsset } from "../../DecorativeAsset";
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
        {/* Champions Wall */}
        <div className="lv-gallery-header">
          <div style={{ marginBottom: "1.5rem" }}>
            <DecorativeAsset src="divider.png" className="lv-divider-img" width={280} height={24} />
          </div>
          <p className="lv-label" style={{ color: "var(--lv-gold)", marginBottom: "0.5rem" }}>
            Hall of Fame
          </p>
          <h1 className="lv-h1">Champions Wall</h1>
        </div>

        {champions.length > 0 ? (
          <GalleryGrid images={champions} />
        ) : (
          <p className="lv-gallery-empty">Photos coming soon — check back after the first tournament.</p>
        )}

        {/* Gallery */}
        <div className="lv-gallery-header" style={{ marginTop: "4rem" }}>
          <div style={{ marginBottom: "1.5rem" }}>
            <DecorativeAsset src="divider.png" className="lv-divider-img" width={280} height={24} />
          </div>
          <p className="lv-label" style={{ color: "var(--lv-gold)", marginBottom: "0.5rem" }}>
            Moments
          </p>
          <h1 className="lv-h1">Gallery</h1>
        </div>

        {gallery.length > 0 ? (
          <GalleryGrid images={gallery} />
        ) : (
          <p className="lv-gallery-empty">Photos coming soon — check back after the first tournament.</p>
        )}
      </div>
    </div>
  );
}
