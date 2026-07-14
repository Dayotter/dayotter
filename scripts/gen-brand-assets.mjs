// Regenerates DayOtter app + store PNG assets from the master SVG.
//   Run from the repo root:  node scripts/gen-brand-assets.mjs
// Source of truth: apps/web/public/brand/dayotter-icon.svg
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const master = fs.readFileSync(path.join(ROOT, "apps/web/public/brand/dayotter-icon.svg"), "utf8");

// The rounded tile group (bg + rim + glow) in the master.
const tileGroupRe = /<g filter="url\(#tileShadow\)">[\s\S]*?<\/g>/;

// Full-bleed opaque square (iOS marketing / Play icons need no transparency).
const fullbleed = master.replace(
  tileGroupRe,
  '<rect x="0" y="0" width="1024" height="1024" fill="url(#bg)"/>\n  <rect x="0" y="0" width="1024" height="1024" fill="url(#bgGlow)"/>',
);

// Content-only (tile removed) on transparent - Android adaptive foreground,
// composited by the OS over the adaptive backgroundColor.
const contentOnly = master.replace(tileGroupRe, "");

const outMobile = path.join(ROOT, "apps/mobile/assets");
const outStore = path.join(ROOT, "apps/mobile/store");
fs.mkdirSync(outMobile, { recursive: true });
fs.mkdirSync(outStore, { recursive: true });

const buf = (svg) => Buffer.from(svg);

async function png(svg, size, dest, { opaque = false, flattenColor = "#0B1F47" } = {}) {
  let img = sharp(buf(svg), { density: 384 }).resize(size, size, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  // Opaque + no alpha channel (App Store rejects marketing icons with alpha).
  if (opaque) img = img.flatten({ background: flattenColor }).removeAlpha();
  await img.png().toFile(dest);
  console.log("wrote", path.relative(ROOT, dest), `${size}x${size}`);
}

// Play feature graphic 1024x500: gradient + centered icon + wordmark.
const innerMaster = master.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="fg" x1="0" y1="0" x2="1024" y2="500" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#244C91"/><stop offset=".45" stop-color="#152F62"/><stop offset="1" stop-color="#081B3E"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#fg)"/>
  <g transform="translate(36 16) scale(0.46)">${innerMaster}</g>
  <text x="540" y="250" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#FFFFFF">DayOtter</text>
  <text x="544" y="312" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="#B9C9E8">Respect every calendar you own.</text>
</svg>`;

await png(fullbleed, 1024, path.join(outMobile, "icon.png"), { opaque: true });
await png(contentOnly, 1024, path.join(outMobile, "adaptive-icon.png"));
await png(master, 1024, path.join(outMobile, "splash-icon.png"));
await png(fullbleed, 48, path.join(outMobile, "favicon.png"), { opaque: true });
await png(fullbleed, 1024, path.join(outStore, "ios-marketing-1024.png"), { opaque: true });
await png(fullbleed, 512, path.join(outStore, "play-icon-512.png"), { opaque: true });
await sharp(buf(feature)).png().toFile(path.join(outStore, "play-feature-graphic-1024x500.png"));
console.log("wrote", "apps/mobile/store/play-feature-graphic-1024x500.png", "1024x500");
