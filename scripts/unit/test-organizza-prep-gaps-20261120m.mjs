import { existsSync, readFileSync } from "node:fs";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const magic = readFileSync("assets/magic-extras-20261120q.js", "utf8");
const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");

ok(
  "stamps 20261120q",
  /magic-extras-20261120q\.js/.test(index) &&
    /20261120q-preview/.test(sw) &&
    /const SHELL_VER = "20261120q"/.test(account) &&
    existsSync("assets/magic-extras-20261120q.js")
);

ok(
  "organize card shows empty days + prep gaps",
  /function collectPrepGaps/.test(magic) &&
    /Giorni senza tappe/.test(magic) &&
    /Manca nella preparazione/.test(magic) &&
    /Ancora da preparare/.test(magic) &&
    /Valigia ancora vuota/.test(magic) &&
    /Nessuna prenotazione salvata/.test(magic) &&
    !/Tutti i luoghi hanno già il loro giorno/.test(magic)
);

if (process.exitCode) process.exit(1);
console.log("organizza-prep-gaps 20261120q (via n) ok");
