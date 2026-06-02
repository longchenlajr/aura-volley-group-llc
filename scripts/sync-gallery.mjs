/**
 * Downloads new photos from a shared Google Drive folder into public/longvolleyball/gallery/.
 * Files are named by their Drive file ID to avoid collisions between family members.
 * HEIC/HEIF files (iPhone default format) are converted to JPEG automatically.
 * Run generate-thumbs.mjs after this to create thumbnails for any new files.
 *
 * Requires: GOOGLE_API_KEY and DRIVE_FOLDER_ID env vars
 * The Drive folder must be shared as "Anyone with the link → Viewer"
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'image/heic': '.jpg',
  'image/heif': '.jpg',
};

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);

async function listFiles(folderId, apiKey, pageToken) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken,files(id,name,mimeType)',
    pageSize: '100',
    key: apiKey,
    ...(pageToken ? { pageToken } : {}),
  });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`);
  if (!res.ok) throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function downloadFile(fileId, destPath, apiKey) {
  const params = new URLSearchParams({ alt: 'media', key: apiKey });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?${params}`);
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  await pipeline(res.body, createWriteStream(destPath));
}

async function main() {
  const { default: sharp } = await import('sharp');

  const apiKey = process.env.GOOGLE_API_KEY;
  const folderId = process.env.DRIVE_FOLDER_ID;

  const galleryDir = path.join(__dirname, '..', 'public', 'longvolleyball', 'gallery');
  fs.mkdirSync(galleryDir, { recursive: true });

  // Paginate through all files in the Drive folder
  let pageToken;
  const allFiles = [];
  do {
    const data = await listFiles(folderId, apiKey, pageToken);
    allFiles.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  const images = allFiles.filter((f) => IMAGE_MIME_TYPES.has(f.mimeType));
  console.log(`Found ${images.length} image(s) in Drive folder.`);

  let newCount = 0;

  for (const file of images) {
    const ext = MIME_TO_EXT[file.mimeType];
    if (!ext) continue;

    // Use Drive file ID as filename to avoid collisions from multiple uploaders
    const destName = `${file.id}${ext}`;
    const destPath = path.join(galleryDir, destName);

    if (fs.existsSync(destPath)) continue;

    console.log(`  + ${file.name} → ${destName}`);

    const tempPath = path.join(os.tmpdir(), `drive-sync-${file.id}`);
    try {
      await downloadFile(file.id, tempPath, apiKey);

      if (HEIC_TYPES.has(file.mimeType)) {
        // Convert iPhone HEIC to JPEG (not supported by browsers)
        await sharp(tempPath).rotate().jpeg({ quality: 90 }).toFile(destPath);
      } else {
        fs.copyFileSync(tempPath, destPath);
      }

      newCount++;
    } catch (err) {
      console.error(`  ! Failed: ${file.name} — ${err.message}`);
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  console.log(`\nDone. ${newCount} new photo(s) downloaded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
