// Crops the composite otter artwork (from ~/Downloads) into individual assets:
// onboarding scenes, feature badges, a wide hero banner, and the OG image.
// Re-run after replacing the source images.  Usage:  node scripts/crop-illustrations.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const DL = path.join(os.homedir(), "Downloads");
const GRID5 = path.join(DL, "ChatGPT Image Jul 12, 2026, 11_58_06 AM.png"); // 1254² - 5 scenes
const COMPOSITE = path.join(DL, "ChatGPT Image Jul 12, 2026, 12_57_57 PM.png"); // 1536×1024 - badge row
const BANNERS = path.join(DL, "ChatGPT Image Jul 12, 2026, 12_57_48 PM.png"); // 1857×847 - banners

const webOut = path.join(process.cwd(), "apps/web/public/brand/illustrations");
const mobOut = path.join(process.cwd(), "apps/mobile/assets/onboarding");
const appDir = path.join(process.cwd(), "apps/web/app");
fs.mkdirSync(webOut, { recursive: true });
fs.mkdirSync(mobOut, { recursive: true });

const roundedMask = (w, h, r) =>
  Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
const circleMask = (d, r = d / 2) =>
  Buffer.from(`<svg width="${d}" height="${d}"><circle cx="${d / 2}" cy="${d / 2}" r="${r}"/></svg>`);

// --- 1. Onboarding scenes (1254² grid) ---
const SCENES = {
  plan: { left: 20, top: 20, width: 592, height: 584 },
  relax: { left: 644, top: 20, width: 592, height: 584 },
  focus: { left: 20, top: 622, width: 390, height: 612 },
  agenda: { left: 434, top: 622, width: 380, height: 612 },
  remind: { left: 836, top: 622, width: 398, height: 612 },
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
  console.log("scene", name);
}

// --- 2. Feature badges (circular icons in the bottom row of the composite) ---
const D = 204; // generous box so the full icon circle is captured (no edge clip)
const R = 98; // mask radius ≈ the icon circle radius (removes navy corners cleanly)
const BADGES = ["scheduling", "secure", "balance", "timezone", "reminders", "track"];
const CENTERS = [128, 384, 640, 896, 1152, 1408];
for (let i = 0; i < BADGES.length; i++) {
  const buf = await sharp(COMPOSITE)
    .extract({ left: CENTERS[i] - D / 2, top: 762, width: D, height: D })
    .composite([{ input: circleMask(D, R), blend: "dest-in" }])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(webOut, `badge-${BADGES[i]}.png`), buf);
  console.log("badge", BADGES[i]);
}

// --- 3. Wide hero banner (top strip of the banners image) ---
const bannerRect = { left: 16, top: 16, width: 1826, height: 460 };
await sharp(BANNERS)
  .extract(bannerRect)
  .composite([{ input: roundedMask(bannerRect.width, bannerRect.height, 40), blend: "dest-in" }])
  .png()
  .toFile(path.join(webOut, "otter-banner.png"));
console.log("banner");

// --- 4. OpenGraph image (1200×630) from the banner + scrim + wordmark ---
const ogCrop = await sharp(BANNERS).extract({ left: 180, top: 16, width: 900, height: 474 }).toBuffer();
const scrim = Buffer.from(
  `<svg width="1200" height="630"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0.4" stop-color="#0b1f47" stop-opacity="0"/><stop offset="1" stop-color="#0b1f47" stop-opacity="0.94"/>` +
    `</linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/>` +
    `<text x="70" y="548" font-family="Helvetica,Arial,sans-serif" font-size="78" font-weight="700" fill="#ffffff">DayOtter</text>` +
    `<text x="72" y="596" font-family="Helvetica,Arial,sans-serif" font-size="30" fill="#c8d4ee">Scheduling that respects every calendar you own.</text></svg>`,
);
await sharp(ogCrop)
  .resize(1200, 630, { fit: "cover", position: "left top" })
  .composite([{ input: scrim, top: 0, left: 0 }])
  .png()
  .toFile(path.join(appDir, "opengraph-image.png"));
console.log("opengraph-image");
