// Normalize raw phone screenshots to Google Play-compliant phone screenshots.
//
// Play rules: PNG/JPEG, each side 320–3840px, long:short ratio must not exceed
// 2:1. Raw captures here are 1080x2376 (2.2:1) — over the limit. We letterbox
// each onto a 1080x2160 (exactly 2:1) canvas in the app's cream background so no
// content is cropped, and strip alpha.
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BG = { r: 0xfa, g: 0xf9, b: 0xf6 }; // #FAF9F6 app background
const CANVAS_W = 1080;
const CANVAS_H = 2160;

const inDir = join(homedir(), "play-shots-raw");
const outDir = join(homedir(), "play-screenshots-final");
mkdirSync(outDir, { recursive: true });

// Ordered so the AI hero leads.
const files = [
  ["06-confirm.png", "1-ask-dayotter.png"],
  ["01-home.png", "2-home.png"],
  ["02-events.png", "3-booking-types.png"],
  ["04-settings.png", "4-settings.png"],
];

for (const [src, dst] of files) {
  const resized = await sharp(join(inDir, src))
    .resize(CANVAS_W, CANVAS_H, { fit: "contain", background: BG })
    .flatten({ background: BG })
    .png()
    .toBuffer();
  await sharp(resized).toFile(join(outDir, dst));
  const meta = await sharp(join(outDir, dst)).metadata();
  console.log(`${dst}  ${meta.width}x${meta.height}  alpha=${meta.hasAlpha}`);
}
console.log("\nWrote to", outDir);
