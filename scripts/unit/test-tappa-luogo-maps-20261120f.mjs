import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function ok(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok - ${label}`);
}

const index = readFileSync("index.html", "utf8");
const sw = readFileSync("sw.js", "utf8");
const account = readFileSync("account.js", "utf8");
const places = readFileSync("places-suggest.js", "utf8");
const spa = readFileSync("assets/index-loadfix-20261120g.js", "utf8");

ok(
  "stamps 20261120l",
  /places-suggest\.js\?v=20261120l/.test(index) &&
    /account\.js\?v=20261120l/.test(index) &&
    /20261120l-layout/.test(sw) &&
    /places-suggest\.js\?v=20261120l/.test(sw) &&
    /index-loadfix-20261120g\.js/.test(sw) &&
    /const SHELL_VER = "20261120l"/.test(account) &&
    /APP_MODULE = "\/assets\/index-loadfix-20261120g\.js"/.test(account) &&
    existsSync("assets/index-loadfix-20261120g.js")
);

ok(
  "SPA marks Indirizzo o località for places suggest",
  /Indirizzo o località`\?`stop`/.test(spa) &&
    /pv-stop-address-field/.test(spa) &&
    /Cerca un luogo o un indirizzo/.test(spa)
);

ok(
  "places-suggest supports stop address mode",
  /isStopAddressInput/.test(places) &&
    /Indirizzo o località/.test(places) &&
    /findCoordInputs/.test(places) &&
    /applyPlaceToStopForm/.test(places) &&
    /scopeParam/.test(places) &&
    /Cerco luoghi e indirizzi/.test(places)
);

ok(
  "stop pick fills lat/lng and opens coordinate details",
  /Latitudine/.test(places) &&
    /Longitudine/.test(places) &&
    /coordinate-details/.test(places) &&
    /setReactInputValue\(lat/.test(places) &&
    /setReactInputValue\(lng/.test(places)
);

ok(
  "destination search still scoped; stop search is broader",
  /scope=destination/.test(places) &&
    /mode === "destination" \? "scope=destination&" : ""/.test(places)
);

ok(
  "map still depends on stop lat/lng after save",
  /Aggiungi le coordinate a una tappa per mostrarla qui/.test(spa) &&
    /lat=n\.lat\.trim\(\)\?Number\(n\.lat\):null/.test(spa) &&
    /Ze=e\.stops\.find\(e=>e\.id===Ce&&e\.lat!==null\)/.test(spa)
);

if (process.exitCode) {
  console.error("tappa-luogo-maps checks failed");
  process.exit(1);
}
console.log("tappa-luogo-maps 20261120l ok");
