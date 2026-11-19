#!/usr/bin/env node
/**
 * Automatic contrast gate for every destination theme template.
 * Adding a new entry to THEMES without readable light/dark contrast fails CI.
 */
import { readFileSync, existsSync } from "node:fs";
import {
  parseThemesFromSource,
  auditAllThemes,
  CONTRAST_SURFACES,
} from "../lib/dest-theme-contrast.mjs";

let failed = 0;
function ok(n, c, d = "") {
  if (c) console.log(`PASS  ${n}${d ? ` — ${d}` : ""}`);
  else {
    failed++;
    console.log(`FAIL  ${n}${d ? ` — ${d}` : ""}`);
  }
}

const dest = readFileSync("destination-theme.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

const themes = parseThemesFromSource(dest);
ok("parses destination themes", themes.length >= 20, `${themes.length} themes`);
ok("includes ghana + default", themes.some((t) => t.id === "gh") && themes.some((t) => t.id === "default"));

const audit = auditAllThemes(themes);
ok("all templates pass light+dark contrast", audit.ok, audit.ok ? `${themes.length} ok` : audit.failed.map((f) => f.id).join(","));
if (!audit.ok) {
  for (const f of audit.failed) {
    for (const issue of f.issues) console.log(`  · ${issue}`);
  }
}

ok(
  "runtime auto-contrast helpers present",
  /function ensureThemeContrast/.test(dest) &&
    /function auditThemeContrastReport/.test(dest) &&
    /__pvAuditDestThemeContrast/.test(dest)
);
ok(
  "universal dest contrast CSS (not only Ghana)",
  /Auto contrast for EVERY destination template/.test(dest) &&
    /--pv-dest-card-dark/.test(dest) &&
    /--pv-dest-ink-dark/.test(dest)
);
ok(
  "scaffold script exists",
  existsSync("scripts/add-dest-theme.mjs") && existsSync("scripts/lib/dest-theme-contrast.mjs")
);
ok(
  "applyCssVars sets dark surface tokens",
  /setProperty\("--pv-dest-card-dark"/.test(dest) && /setProperty\("--pv-dest-ink-dark"/.test(dest)
);
ok(
  "docs note on THEMES contrast",
  /CONTRAST: every new template is audited automatically/.test(dest)
);
ok(
  "AA thresholds wired",
  CONTRAST_SURFACES.AA_NORMAL === 4.5 && CONTRAST_SURFACES.AA_LARGE === 3
);
ok(
  "stamps",
  /destination-theme-20261119u\.js/.test(index) &&
    /20261120a-iafile/.test(sw) &&
    /account\.js\?v=20261119u/.test(index) &&
    /const SHELL_VER = "20261120a"/.test(account) &&
    existsSync("assets/destination-theme-20261119u.js")
);
ok(
  "asset mirrors source",
  existsSync("assets/destination-theme-20261119u.js") &&
    readFileSync("assets/destination-theme-20261119u.js", "utf8") === dest
);

if (failed) {
  console.log(`\n${failed} FAIL`);
  process.exit(1);
}
console.log("\nOK");
