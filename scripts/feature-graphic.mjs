import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";

const root = join(homedir(), "dayotter", "apps", "web", "public", "brand");
const otter = readFileSync(join(root, "illustrations", "otter-plan.png")).toString("base64");

// 1024x500 Google Play feature graphic. Text kept left, otter right, brand glow
// behind it. Rendered from SVG, then flattened to a 24-bit PNG (no alpha).
const svg = `
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#191327"/>
      <stop offset="1" stop-color="#0e0a16"/>
    </linearGradient>
    <radialGradient id="glow" cx="74%" cy="52%" r="52%">
      <stop offset="0" stop-color="#6743e6" stop-opacity="0.60"/>
      <stop offset="1" stop-color="#6743e6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="6%" cy="8%" r="42%">
      <stop offset="0" stop-color="#6743e6" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#6743e6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <rect width="1024" height="500" fill="url(#glow)"/>
  <rect width="1024" height="500" fill="url(#glow2)"/>

  <!-- faint dotted grid, subtle texture -->
  <g fill="#ffffff" opacity="0.05">
    ${Array.from({ length: 6 })
      .flatMap((_, r) =>
        Array.from({ length: 9 }).map((__, c) => `<circle cx="${70 + c * 60}" cy="${70 + r * 70}" r="2"/>`),
      )
      .join("")}
  </g>

  <!-- otter, right side, with a soft plate behind it -->
  <ellipse cx="800" cy="255" rx="215" ry="215" fill="#6743e6" opacity="0.14"/>
  <image x="618" y="55" width="360" height="360" preserveAspectRatio="xMidYMid meet"
    href="data:image/png;base64,${otter}"/>

  <!-- copy -->
  <text x="82" y="150" font-family="Helvetica, Arial, sans-serif" font-size="19"
    letter-spacing="4" font-weight="600" fill="#a892ff">AI SCHEDULING ASSISTANT</text>
  <text x="80" y="248" font-family="Helvetica, Arial, sans-serif" font-size="86"
    font-weight="700" fill="#ffffff" letter-spacing="-2">DayOtter</text>
  <rect x="84" y="276" width="60" height="4" rx="2" fill="#6743e6"/>
  <text x="82" y="330" font-family="Helvetica, Arial, sans-serif" font-size="31"
    font-weight="500" fill="#e7e3f2">Scheduling that respects</text>
  <text x="82" y="372" font-family="Helvetica, Arial, sans-serif" font-size="31"
    font-weight="500" fill="#e7e3f2">your time.</text>
  <text x="82" y="430" font-family="Helvetica, Arial, sans-serif" font-size="22"
    font-weight="400" fill="#9a90b5">Book meetings, protect focus, done for you.</text>
</svg>`;

const out = join(homedir(), "DayOtter-feature-graphic.png");
await sharp(Buffer.from(svg))
  .resize(1024, 500)
  .flatten({ background: "#0e0a16" }) // drop alpha → 24-bit
  .png({ compressionLevel: 9 })
  .toFile(out);

const meta = await sharp(out).metadata();
console.log(`wrote ${out} - ${meta.width}x${meta.height}, channels=${meta.channels}, alpha=${meta.hasAlpha}`);
