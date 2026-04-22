/**
 * Generate WebP thumbnails for gallery images.
 *
 * Usage:  node scripts/generate-thumbs.mjs
 *
 * For each image in the source directories, creates an 800px-wide WebP
 * thumbnail in a `thumbs/` subdirectory. Skips images that already have
 * an up-to-date thumbnail.
 *
 * Requires: npm install sharp (dev dependency)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "..", "public", "longvolleyball");

const DIRS = ["champions", "gallery"];
const EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"]);
const THUMB_WIDTH = 800;
const QUALITY = 78;

async function processDir(dirName) {
  const srcDir = path.join(PUBLIC, dirName);
  const thumbDir = path.join(srcDir, "thumbs");

  if (!fs.existsSync(srcDir)) {
    console.log(`  skip ${dirName}/ — directory not found`);
    return 0;
  }

  fs.mkdirSync(thumbDir, { recursive: true });

  const files = fs
    .readdirSync(srcDir)
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return EXTENSIONS.has(ext) && !fs.statSync(path.join(srcDir, f)).isDirectory();
    });

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const baseName = path.parse(file).name;
    const outPath = path.join(thumbDir, `${baseName}.webp`);

    // Skip if thumb exists and is newer than source
    if (fs.existsSync(outPath)) {
      const srcStat = fs.statSync(srcPath);
      const outStat = fs.statSync(outPath);
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        skipped++;
        continue;
      }
    }

    try {
      await sharp(srcPath)
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(outPath);
      created++;
      const srcSize = (fs.statSync(srcPath).size / 1024).toFixed(0);
      const outSize = (fs.statSync(outPath).size / 1024).toFixed(0);
      console.log(`  ${dirName}/${file} — ${srcSize}KB → ${outSize}KB`);
    } catch (err) {
      console.error(`  ERROR ${dirName}/${file}: ${err.message}`);
    }
  }

  console.log(`  ${dirName}/: ${created} created, ${skipped} skipped (up-to-date)`);
  return created;
}

console.log("Generating WebP thumbnails...\n");
let total = 0;
for (const dir of DIRS) {
  total += await processDir(dir);
}
console.log(`\nDone. ${total} thumbnails generated.`);
