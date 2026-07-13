import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

// Normalize phone screenshots to Google Play's spec: 9:16 (portrait) or 16:9
// (landscape), 1080x1920 / 1920x1080, 24-bit PNG (no alpha). "cover" keeps the
// content's aspect and center-crops the excess (e.g. trims the 20:9 status/nav
// bars) rather than squashing or letterboxing.
const inDir = join(homedir(), "play-screenshots-in");
const outDir = join(homedir(), "play-screenshots-out");
if (!existsSync(inDir)) {
  mkdirSync(inDir, { recursive: true });
  console.log(`Created ${inDir}. Drop your phone screenshots (PNG/JPG) in there and re-run.`);
  process.exit(0);
}
mkdirSync(outDir, { recursive: true });

const files = readdirSync(inDir).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (files.length === 0) {
  console.log(`No images in ${inDir}. Add 2–8 phone screenshots and re-run.`);
  process.exit(0);
}

let i = 0;
for (const f of files.sort()) {
  const meta = await sharp(join(inDir, f)).metadata();
  const portrait = (meta.height ?? 0) >= (meta.width ?? 0);
  const [w, h] = portrait ? [1080, 1920] : [1920, 1080];
  i += 1;
  const out = join(outDir, `screenshot-${String(i).padStart(2, "0")}.png`);
  await sharp(join(inDir, f))
    .resize(w, h, { fit: "cover", position: "center" })
    .flatten({ background: "#ffffff" })
    .png()
    .toFile(out);
  console.log(`${f}  ->  ${out}  (${w}x${h})`);
}
console.log(`\nDone. ${i} Play-ready screenshot(s) in ${outDir}. Upload 2–8 of them.`);
