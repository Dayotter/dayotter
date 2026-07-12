// Crops the composite otter artwork (from ~/Downloads) into individual, rounded
// illustrations used by the onboarding flow + marketing. Re-run after replacing
// the source images.  Usage:  node scripts/crop-illustrations.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const DL = path.join(os.homedir(), "Downloads");
const GRID5 = path.join(DL, "ChatGPT Image Jul 12, 2026, 11_58_06 AM.png"); // 1254×1254, 5 scenes

const webOut = path.join(process.cwd(), "apps/web/public/brand/illustrations");
const mobOut = path.join(process.cwd(), "apps/mobile/assets/onboarding");
fs.mkdirSync(webOut, { recursive: true });
fs.mkdirSync(mobOut, { recursive: true });

// Rounded-rect alpha mask so corners are transparent (drops onto any background).
const roundedMask = (w, h, r) =>
  Buffer.from(
    `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`,
  );

// left, top, width, height inside the 1254² grid (tight to each panel's colour).
const SCENES = {
  "plan": { left: 20, top: 20, width: 592, height: 584 }, // otter + calendar + pen
  "relax": { left: 644, top: 20, width: 592, height: 584 }, // otter in hammock w/ phone
  "focus": { left: 20, top: 622, width: 390, height: 612 }, // otter at laptop
  "agenda": { left: 434, top: 622, width: 380, height: 612 }, // phone "Today" mockup
  "remind": { left: 836, top: 622, width: 398, height: 612 }, // otter + calendar + clock
};

for (const [name, rect] of Object.entries(SCENES)) {
  const r = Math.round(Math.min(rect.width, rect.height) * 0.07);
  const buf = await sharp(GRID5)
    .extract(rect)
    .composite([{ input: roundedMask(rect.width, rect.height, r), blend: "dest-in" }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(webOut, `otter-${name}.png`), buf);
  fs.writeFileSync(path.join(mobOut, `${name}.png`), buf);
  console.log("wrote", `otter-${name}.png`, `${rect.width}×${rect.height}`);
}
