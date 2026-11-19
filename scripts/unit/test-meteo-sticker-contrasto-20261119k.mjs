#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

let failed = 0;
function ok(name, cond, detail = "") {
  if (cond) console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const magic = readFileSync("magic-extras.js", "utf8");
const diary = readFileSync("travel-diary.css", "utf8");
const ux = readFileSync("ux-suite.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");

ok(
  "weather sticker helpers",
  /weatherStickerFromCode/.test(magic) &&
    /weatherStickerFromClimate/.test(magic) &&
    /pv-weather-sticker/.test(magic) &&
    /pv-weather-copy/.test(magic)
);

ok(
  "climate sticker uses precip+temp heuristics",
  /rain >= 0\.8/.test(magic) && /temp >= 24/.test(magic)
);

ok(
  "Ghana panel wash contrasts vs white cards",
  /--diary-card: #ffffff/.test(diary) &&
    /linear-gradient\(180deg, #e8d8a8/.test(diary) &&
    /background: var\(--diary-card, #fff\)/.test(diary) &&
    /html\[data-pv-dest="gh"\] #root \.pv-day-weather/.test(diary)
);

ok(
  "stamps",
  /ux-suite-20261119k\.js/.test(index) &&
    /magic-extras-20261119k\.js/.test(index) &&
    /travel-diary\.css\?v=20261119k-meteo/.test(index) &&
    /20261119k-meteo/.test(sw) &&
    existsSync("assets/ux-suite-20261119k.js") &&
    existsSync("assets/magic-extras-20261119k.js") &&
    /const STYLE_VER = "20261119k"/.test(ux) &&
    /dataset\.pvReady = "20261119k"/.test(magic)
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
