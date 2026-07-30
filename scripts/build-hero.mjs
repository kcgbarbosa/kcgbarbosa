import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FACE, IMG, PALETTE, PREVIEW, THEMES,
  doc, loadPhotos, photo, photoDefs, photoImage, shape,
} from "./lib/design.mjs";

const W = 900;

const DRIFT_EASE = "0.42 0 0.58 1";

const photos = loadPhotos();
if (!photos) console.warn("build/photos.json missing - run scripts/prepare-photos.py");

function pets(theme) {
  const t = PALETTE[theme];
  const ns = `p${theme}`;
  const R = 98, PAN = 10, GAP_Y = 26;
  const cx = [320, 580];
  const H = R * 2 + 34 + GAP_Y + 32;
  const cy = 30 + R;

  const list = photos?.pets ?? [];
  const labels = shape(list.map((p, i) => ({
    id: `pet${i}`, text: p.name, size: 15, tracking: 2.4,
    font: FACE.mono.file, axes: FACE.mono.axes,
  })));

  const one = (i) => {
    const p = list[i];
    const inner = p
      ? photoImage(p.uri, { x: cx[i] - R - PAN, y: cy - R - PAN, w: (R + PAN) * 2, h: (R + PAN) * 2 })
      : photo(ns, cx[i] + R + PAN * 2, cy + R + PAN * 2);
    const label = labels[`pet${i}`];
    return `
  <g clip-path="url(#${ns}-c${i})">
    <g>
      ${inner}
      <animateTransform attributeName="transform" type="translate"
        values="0,0; -${PAN},-${(PAN * 0.7).toFixed(1)}; 0,0" dur="${44 + i * 9}s"
        calcMode="spline" keyTimes="0;0.5;1" keySplines="${DRIFT_EASE};${DRIFT_EASE}"
        repeatCount="indefinite"/>
    </g>
  </g>
  <circle cx="${cx[i]}" cy="${cy}" r="${R + 5}" fill="none" stroke="${t.ink}" stroke-width="2.5" opacity="0.45"/>
  ${label ? `<g transform="translate(${(cx[i] - label.width / 2).toFixed(1)} ${cy + R + 34})">
    <path d="${label.d}" fill="${t.muted}"/>
  </g>` : ""}`;
  };

  const clips = cx.map((x, i) =>
    `<clipPath id="${ns}-c${i}"><circle cx="${x}" cy="${cy}" r="${R}"/></clipPath>`).join("\n    ");

  return doc(W, H, `
  <defs>
    ${photoDefs(ns, t)}
    ${clips}
  </defs>
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${cx.map((_, i) => one(i)).join("\n")}`,
    list.map((p) => p.alt).join(" and ") || "The co-maintainers");
}

mkdirSync(IMG, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

const built = [];
for (const theme of THEMES) {
  const svg = pets(theme);
  writeFileSync(join(IMG, `co-maintainers-${theme}.svg`), svg);
  built.push({ name: "co-maintainers", theme, bytes: Buffer.byteLength(svg) });
}

const swatches = (theme) => Object.entries(PALETTE[theme])
  .map(([k, v]) => `<div class="sw"><i style="background:${v}"></i><b>${k}</b><code>${v}</code></div>`)
  .join("");

writeFileSync(join(PREVIEW, "hero.html"), `<!doctype html>
<meta charset="utf-8">
<title>Co-maintainers</title>
<style>
  body { margin:0; padding:40px 32px 80px; background:#17120A; color:#F7EDD8;
         font:15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; }
  .sub { color:#AC9369; margin:0 0 32px; max-width:74ch; }
  h3 { font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#EFBC55;
       border-top:1px solid #3E2E1A; padding-top:18px; margin:40px 0 18px; }
  figure { margin:0 0 12px; }
  .frame { border:1px solid #3E2E1A; line-height:0; }
  .frame svg { display:block; width:100%; height:auto; }
  .sws { display:flex; flex-wrap:wrap; gap:14px; margin-bottom:12px; }
  .sw { display:flex; align-items:center; gap:7px; font-size:12px; }
  .sw i { width:26px; height:26px; border-radius:4px; border:1px solid #3E2E1A; display:block; }
  .sw code { color:#AC9369; }
</style>
<h1>Co-maintainers</h1>
<p class="sub">Two portraits cut from the one photo that has them both, drifting on a slow pendulum ease.</p>

${THEMES.map((th) => `<figure><div class="frame">${pets(th)}</div></figure>`).join("")}

<h3>Palette</h3>
<div class="sws">${swatches("light")}</div>
<div class="sws">${swatches("dark")}</div>
`);

const totalKb = built.reduce((n, b) => n + b.bytes, 0) / 1024;
console.log(built.map((b) => `${b.name}-${b.theme}  ${(b.bytes / 1024).toFixed(1)} KB`).join("\n"));
console.log(`--- one theme: ${(totalKb / 2).toFixed(1)} KB`);
