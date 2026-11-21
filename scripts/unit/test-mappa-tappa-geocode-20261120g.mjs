import { existsSync, readFileSync } from "node:fs";

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
const magic = readFileSync("assets/magic-extras-20261120q.js", "utf8");
const spa = readFileSync("assets/index-loadfix-20261120g.js", "utf8");

ok(
  "stamps 20261120k",
  /magic-extras-20261120q\.js/.test(index) &&
    /places-suggest\.js\?v=20261120q/.test(index) &&
    /account\.js\?v=20261120q/.test(index) &&
    /20261120q-preview/.test(sw) &&
    /index-loadfix-20261120g\.js/.test(sw) &&
    /const SHELL_VER = "20261120q"/.test(account) &&
    /APP_MODULE = "\/assets\/index-loadfix-20261120g\.js"/.test(account) &&
    existsSync("assets/magic-extras-20261120q.js") &&
    existsSync("assets/index-loadfix-20261120g.js")
);

ok(
  "geocodePlace fills missing stop coords for map",
  /async function geocodePlace/.test(magic) &&
    /Cerco i luoghi delle tappe sulla mappa/.test(magic) &&
    /__pvGeocodeFail/.test(magic) &&
    /needsCoords/.test(magic) &&
    /remountTripSection\(auth, "itinerary"\)/.test(magic)
);

ok(
  "SPA geocodes address on stop save when lat/lng empty",
  /v===`stop`/.test(spa) &&
    /\/api\/places\?q=/.test(spa) &&
    /lat=n\.lat\.trim\(\)\?Number\(n\.lat\):null/.test(spa)
);

ok(
  "places-suggest blur geocodes stop address",
  /focusout/.test(places) &&
    /isStopAddressInput\(input\)/.test(places) &&
    /applyPlaceToStopForm\(input, place\)/.test(places)
);

if (process.exitCode) {
  console.error("mappa-tappa-geocode checks failed");
  process.exit(1);
}
console.log("mappa-tappa-geocode 20261120k ok");
