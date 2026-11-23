import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120s.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120s",
  /magic-extras-20261120s\.js/.test(index) &&
    /20261120t-assicura/.test(sw) &&
    /const SHELL_VER = "20261120t"/.test(account) &&
    existsSync("assets/magic-extras-20261120s.js") &&
    /dataset\.pvReady = "20261120s"/.test(magic)
);

ok(
  "per-line Salva voce + Elimina actions",
  /data-save-line/.test(magic) &&
    /Salva voce/.test(magic) &&
    /data-remove-line/.test(magic) &&
    /Elimina/.test(magic) &&
    /pv-tp-line-actions/.test(magic)
);

ok(
  "payment strip always visible (not buried in details)",
  /pv-tp-pay-strip/.test(magic) &&
    /Hai già versato/.test(magic) &&
    /Salda tutto/.test(magic) &&
    !/<details class="pv-payment-controls">/.test(magic)
);

ok(
  "live preview + dirty card while editing",
  /function syncPreventivoLinePreview/.test(magic) &&
    /data-line-title/.test(magic) &&
    /data-line-total/.test(magic) &&
    /data-dirty/.test(magic) &&
    /list\.oninput/.test(magic)
);

ok(
  "save/remove wire to saveTripPreventivoSection",
  /data-save-line[\s\S]*saveTripPreventivoSection/.test(magic) &&
    /data-remove-line[\s\S]*saveTripPreventivoSection/.test(magic) &&
    /Salva tutte/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("preventivo-salva-voce 20261120s ok");
