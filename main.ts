// news-image-20261121: "The World in One Day - Saturday 21 November 2026"
// A program that draws a newspaper front page summing up the world's news
// of Saturday 21 November 2026 as one 1024x1024 PNG.
// Written from scratch for this entry: own 5x7 bitmap font (glyphs stored as
// seven 5-bit rows), own PNG encoder, own geometric icons. Node 22 standard
// library only, no network, no external assets. Deterministic: the same bytes
// on every run. Writes entry.png to $MAKEFUN_OUTPUT_DIR (or /output).

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------- 5x7 bitmap font ----------
// Each glyph is seven numbers; each number holds five bits, bit 4 (16) is the
// leftmost column, bit 0 (1) the rightmost. Uppercase, digits and punctuation
// only: all text is uppercased before drawing.
type Glyph = [number, number, number, number, number, number, number];
const GLYPHS: Record<string, Glyph> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [15, 16, 16, 16, 16, 16, 15],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [15, 16, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 25, 21, 19, 19, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 27, 17],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  "0": [14, 19, 21, 25, 17, 17, 14],
  "1": [4, 12, 4, 4, 4, 4, 14],
  "2": [14, 17, 1, 2, 4, 8, 31],
  "3": [30, 1, 1, 14, 1, 1, 30],
  "4": [2, 6, 10, 18, 31, 2, 2],
  "5": [31, 16, 30, 1, 1, 17, 14],
  "6": [14, 16, 16, 30, 17, 17, 14],
  "7": [31, 1, 2, 2, 4, 4, 4],
  "8": [14, 17, 17, 14, 17, 17, 14],
  "9": [14, 17, 17, 15, 1, 1, 14],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 12, 12, 8],
  "-": [0, 0, 0, 14, 0, 0, 0],
  "'": [4, 4, 4, 0, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "%": [25, 26, 4, 8, 19, 19, 0],
  $: [4, 15, 20, 14, 5, 30, 4],
  "&": [12, 18, 18, 8, 21, 18, 13],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "?": [14, 17, 1, 2, 4, 0, 4],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "+": [0, 4, 4, 31, 4, 4, 0],
};

// ---------- PNG encoder ----------
// Builds a truecolour (colour type 2, bit depth 8) PNG: IHDR, one IDAT with
// the zlib-deflated scanlines (filter 0 on every row), IEND. CRC-32 uses the
// standard polynomial, table built once at startup.
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32Bytes(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(kind: string, payload: Buffer): Buffer {
  const out = Buffer.alloc(12 + payload.length);
  out.writeUInt32BE(payload.length, 0);
  out.write(kind, 4, "ascii");
  payload.copy(out, 8);
  const crcInput = Buffer.concat([Buffer.from(kind, "ascii"), payload]);
  out.writeUInt32BE(crc32Bytes(crcInput), 8 + payload.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour RGB
  header[10] = 0; // compression
  header[11] = 0; // filter
  header[12] = 0; // interlace
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(
      raw,
      y * (1 + width * 3) + 1,
    );
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Canvas ----------
// A 1024x1024 RGB framebuffer; every drawing call writes into it.
const W = 1024;
const H = 1024;
const canvas = new Uint8Array(W * H * 3);

type Colour = [number, number, number];
const PAPER: Colour = [247, 243, 232];
const INK: Colour = [24, 24, 24];
const RED: Colour = [176, 30, 30];
const BLUE: Colour = [30, 58, 120];
const SKY: Colour = [96, 142, 196];
const GREY: Colour = [112, 108, 96];
const WHITE: Colour = [255, 255, 255];
const GOLD: Colour = [198, 148, 32];
const GREEN: Colour = [46, 110, 60];

function paintAll(c: Colour): void {
  for (let i = 0; i < W * H; i++) {
    canvas[i * 3] = c[0];
    canvas[i * 3 + 1] = c[1];
    canvas[i * 3 + 2] = c[2];
  }
}

function put(x: number, y: number, c: Colour): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  canvas[i] = c[0];
  canvas[i + 1] = c[1];
  canvas[i + 2] = c[2];
}

function fillBox(x: number, y: number, w: number, h: number, c: Colour): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) put(xx, yy, c);
  }
}

function frameBox(x: number, y: number, w: number, h: number, c: Colour, t = 1): void {
  fillBox(x, y, w, t, c);
  fillBox(x, y + h - t, w, t, c);
  fillBox(x, y, t, h, c);
  fillBox(x + w - t, y, t, h, c);
}

// Bresenham line.
function drawLine(x0: number, y0: number, x1: number, y1: number, c: Colour): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    put(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function drawDisc(cx: number, cy: number, r: number, c: Colour): void {
  for (let yy = -r; yy <= r; yy++) {
    for (let xx = -r; xx <= r; xx++) {
      if (xx * xx + yy * yy <= r * r) put(cx + xx, cy + yy, c);
    }
  }
}

function drawRing(cx: number, cy: number, r: number, c: Colour, t = 2): void {
  for (let yy = -r - t; yy <= r + t; yy++) {
    for (let xx = -r - t; xx <= r + t; xx++) {
      const d = Math.sqrt(xx * xx + yy * yy);
      if (d >= r - t / 2 && d <= r + t / 2) put(cx + xx, cy + yy, c);
    }
  }
}

// ---------- Text ----------
// One glyph cell is 6 units wide (5 + 1 spacing) and 7 units tall.
function glyphWidth(scale: number): number {
  return 6 * scale;
}

function measure(text: string, scale: number): number {
  return text.toUpperCase().length * glyphWidth(scale) - scale;
}

function drawGlyph(x: number, y: number, ch: string, scale: number, c: Colour): void {
  const g = GLYPHS[ch];
  if (!g) return;
  for (let row = 0; row < 7; row++) {
    const bits = g[row];
    for (let col = 0; col < 5; col++) {
      if (bits & (16 >> col)) {
        fillBox(x + col * scale, y + row * scale, scale, scale, c);
      }
    }
  }
}

function drawText(x: number, y: number, text: string, scale: number, c: Colour): void {
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    drawGlyph(x + i * glyphWidth(scale), y, upper[i], scale, c);
  }
}

function drawCentred(cx: number, y: number, text: string, scale: number, c: Colour): void {
  drawText(cx - Math.floor(measure(text, scale) / 2), y, text, scale, c);
}

// Greedy word wrap; returns lines that fit maxW.
function wrap(text: string, scale: number, maxW: number): string[] {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const trial = line ? line + " " + word : word;
    if (measure(trial, scale) <= maxW || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draws wrapped text, returns the y just below the last line.
function drawWrapped(
  x: number,
  y: number,
  text: string,
  scale: number,
  maxW: number,
  c: Colour,
  leading: number,
): number {
  let yy = y;
  for (const line of wrap(text, scale, maxW)) {
    drawText(x, yy, line, scale, c);
    yy += 7 * scale + leading;
  }
  return yy;
}

// ---------- Icons ----------
// Small geometric drawings, one per story. All coordinates are local to the
// icon's origin; callers place them clear of text.

// Explosion burst: twelve spokes, a filled centre and a ring.
function burst(cx: number, cy: number, r: number, c: Colour): void {
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    const len = k % 2 === 0 ? r : Math.floor(r * 0.62);
    drawLine(cx, cy, Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len), c);
  }
  drawDisc(cx, cy, Math.max(3, Math.floor(r * 0.28)), c);
  drawRing(cx, cy, Math.floor(r * 0.55), c, 2);
}

// Falling market chart: a descending zigzag with an arrowhead, over a baseline.
function chartDown(x: number, y: number): void {
  const pts: Array<[number, number]> = [
    [0, 6],
    [16, 14],
    [28, 10],
    [44, 26],
    [58, 34],
    [70, 52],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    drawLine(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], RED);
    drawLine(x + pts[i][0], y + pts[i][1] + 1, x + pts[i + 1][0], y + pts[i + 1][1] + 1, RED);
  }
  drawLine(x + 70, y + 52, x + 59, y + 50, RED);
  drawLine(x + 70, y + 52, x + 68, y + 40, RED);
  fillBox(x, y + 58, 72, 2, GREY);
}

// Seismograph zigzag with two ground cracks below it.
function quakeMark(x: number, y: number): void {
  const pts: Array<[number, number]> = [
    [0, 22],
    [12, 22],
    [20, 4],
    [28, 40],
    [36, 10],
    [44, 32],
    [52, 22],
    [70, 22],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    drawLine(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], INK);
  }
  drawLine(x + 10, y + 50, x + 24, y + 64, INK);
  drawLine(x + 24, y + 64, x + 36, y + 56, INK);
  drawLine(x + 44, y + 50, x + 58, y + 66, INK);
}

// Globe: ring, equator, meridian and two side meridians, with a small sun.
function globeMark(cx: number, cy: number, r: number): void {
  drawRing(cx, cy, r, BLUE, 2);
  drawLine(cx - r, cy, cx + r, cy, BLUE);
  drawLine(cx, cy - r, cx, cy + r, BLUE);
  const off = Math.floor(r * 0.55);
  drawLine(cx - off, cy - r + 4, cx - off, cy + r - 4, BLUE);
  drawLine(cx + off, cy - r + 4, cx + off, cy + r - 4, BLUE);
  drawDisc(cx + Math.floor(r * 0.42), cy - Math.floor(r * 0.45), 4, GOLD);
}

// Poland: white over red.
function flagPoland(x: number, y: number, w: number, h: number): void {
  const half = Math.ceil(h / 2);
  fillBox(x, y, w, half, WHITE);
  fillBox(x, y + half, w, h - half, RED);
}

// Union Jack, simplified: blue field, white diagonals, white cross, red cross.
function flagUK(x: number, y: number, w: number, h: number): void {
  fillBox(x, y, w, h, BLUE);
  for (let o = -2; o <= 2; o++) {
    drawLine(x, y + o, x + w, y + h + o, WHITE);
    drawLine(x + w, y + o, x, y + h + o, WHITE);
  }
  fillBox(x, y + Math.floor(h / 2) - 4, w, 8, WHITE);
  fillBox(x + Math.floor(w / 2) - 4, y, 8, h, WHITE);
  fillBox(x, y + Math.floor(h / 2) - 2, w, 4, RED);
  fillBox(x + Math.floor(w / 2) - 2, y, 4, h, RED);
}

// European Union: blue field, twelve gold stars in a circle.
function flagEU(x: number, y: number, w: number, h: number): void {
  fillBox(x, y, w, h, BLUE);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.32;
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6 - Math.PI / 2;
    drawDisc(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 2, GOLD);
  }
}

// Interception: two streaks meeting in a small burst.
function interceptMark(x: number, y: number): void {
  drawLine(x, y + 44, x + 30, y + 8, INK);
  drawLine(x + 56, y + 44, x + 30, y + 8, RED);
  burst(x + 30, y + 8, 10, RED);
}

// ---------- Stories ----------
// Six stories from Saturday 21 November 2026, verified against wire reports
// and same-day news digests at build time.
const LEAD_HEADLINE_1 = "RUSSIA'S BIGGEST AIR ATTACK ON UKRAINE";
const LEAD_HEADLINE_2 = "MISSILES LAND IN POLAND";
const LEAD_BODY =
  "More than 400 drones and 110 missiles strike Ukraine overnight in Russia's biggest air attack of the war. At least eight people are killed in Kyiv. Two missiles and a suspected drone come down in Poland, and Prime Minister Tusk calls it a deliberate provocation as NATO jets scramble.";

type StoryCell = {
  kicker: string;
  headline: string;
  body: string;
  icon: "chart" | "quake" | "globe" | "flags";
};

const CELLS: StoryCell[] = [
  {
    kicker: "MARKETS",
    headline: "AI SELL-OFF DRAGS WALL ST INTO CORRECTION",
    body: "The S&P 500 falls 3.7% and the Nasdaq 5.28% as an AI rout wipes out the Nasdaq's 2026 gains. The SEC probes Nvidia accounting; its shares drop 13.8%.",
    icon: "chart",
  },
  {
    kicker: "DISASTER",
    headline: "6.8 QUAKE SHAKES PERU",
    body: "A magnitude 6.8 earthquake strikes the Junin region of central Peru, with tremors felt in Lima, 320 km away. One person is hurt; buildings and roads are damaged.",
    icon: "quake",
  },
  {
    kicker: "CLIMATE",
    headline: "COP31 MISSES DEADLINE IN ANTALYA",
    body: "The climate summit in Antalya overruns its deadline as talks drag on. The latest political draft drops any mention of fossil fuels.",
    icon: "globe",
  },
  {
    kicker: "DIPLOMACY",
    headline: "UK AND EU SEAL POST-BREXIT DEALS",
    body: "Britain and the EU agree their biggest step since Brexit: food checks go from March 2028, carbon markets link from January 2028, and 100,000 young people a side can live and work abroad.",
    icon: "flags",
  },
];

const BOTTOM =
  "SAUDI COALITION INTERCEPTS HOUTHI MISSILES AIMED AT RIYADH - THE THIRD NIGHT RUNNING. THE HOUTHIS THREATEN PORTS AND A POWER STATION AS SAUDI-LED STRIKES HIT HODEIDAH, SANAA, SAADA AND TAIZ.";

// ---------- Page ----------
// 1024x1024 newspaper front page: masthead, lead story with a blast graphic,
// a 2x2 grid of four stories, a bottom band with the sixth story, footer.
function drawCell(x: number, y: number, cell: StoryCell): void {
  const cellW = 466;
  const cellH = 240;
  const textW = 352;
  fillBox(x, y, cellW, cellH, WHITE);
  frameBox(x, y, cellW, cellH, INK, 2);
  drawText(x + 14, y + 12, cell.kicker, 1, RED);
  const headLines = wrap(cell.headline, 3, textW);
  let hy = y + 32;
  for (const line of headLines.slice(0, 3)) {
    drawText(x + 14, hy, line, 3, INK);
    hy += 24;
  }
  const bodyY = y + 32 + Math.min(headLines.length, 3) * 24 + 8;
  drawWrapped(x + 14, bodyY, cell.body, 2, textW, INK, 4);
  // Icon in the bottom-right corner, clear of the text column.
  if (cell.icon === "chart") chartDown(x + 378, y + 162);
  if (cell.icon === "quake") quakeMark(x + 378, y + 158);
  if (cell.icon === "globe") globeMark(x + 416, y + 196, 32);
  if (cell.icon === "flags") {
    flagUK(x + 378, y + 152, 76, 36);
    frameBox(x + 378, y + 152, 76, 36, INK, 1);
    flagEU(x + 378, y + 192, 76, 36);
    frameBox(x + 378, y + 192, 76, 36, INK, 1);
  }
}

function drawPage(): void {
  paintAll(PAPER);

  // Masthead
  drawCentred(512, 22, "THE WORLD IN ONE DAY", 5, INK);
  drawCentred(512, 72, "SATURDAY 21 NOVEMBER 2026", 2, INK);
  fillBox(40, 104, 944, 3, INK);
  fillBox(40, 110, 944, 2, RED);

  // Lead story: Russia's air attack, missiles in Poland
  drawText(40, 126, "CONFLICT", 1, RED);
  drawText(984 - measure("KYIV - WARSAW", 1), 126, "KYIV - WARSAW", 1, GREY);
  drawText(40, 142, LEAD_HEADLINE_1, 4, INK);
  drawText(40, 172, LEAD_HEADLINE_2, 4, INK);
  drawWrapped(40, 206, LEAD_BODY, 2, 600, INK, 4);
  // Blast graphic with missile streaks and the Polish flag
  burst(755, 258, 44, RED);
  drawLine(836, 196, 792, 232, INK);
  drawLine(846, 318, 798, 282, INK);
  drawLine(692, 318, 726, 288, INK);
  flagPoland(868, 214, 96, 60);
  frameBox(868, 214, 96, 60, INK, 1);
  drawCentred(916, 282, "POLAND", 1, GREY);
  fillBox(40, 330, 944, 2, INK);

  // 2x2 grid of four more stories
  const xs = [40, 518];
  const ys = [346, 600];
  for (let i = 0; i < 4; i++) {
    drawCell(xs[i % 2], ys[Math.floor(i / 2)], CELLS[i]);
  }

  // Bottom band: the sixth story
  fillBox(40, 856, 944, 84, WHITE);
  frameBox(40, 856, 944, 84, INK, 2);
  drawText(54, 866, "ALSO", 1, RED);
  drawWrapped(54, 884, BOTTOM, 2, 820, INK, 4);
  interceptMark(902, 872);

  // Footer
  drawCentred(512, 956, "SIX STORIES FROM SATURDAY 21 NOVEMBER 2026 - DRAWN FROM WIRE REPORTS", 1, GREY);
  fillBox(40, 986, 944, 2, INK);
}

// ---------- Main ----------
function main(): void {
  drawPage();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "entry.png"), encodePng(W, H, canvas));
}

main();
