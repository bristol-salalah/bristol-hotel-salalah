#!/usr/bin/env node
/* Set the dashboard's login and password.

   The dashboard has no server, so the login cannot be checked anywhere. Instead the
   password locks (encrypts) the GitHub access key, and the locked key is saved in
   admin/access.json. Typing the right login and password in the browser unlocks it.

   Usage:   BH_TOKEN=github_pat_... node tools/make_login.mjs <login> [password]
   Leave the password out and one is made up for you: four everyday words and a number.

   The locked key is public, so anyone can try passwords against it for as long as they
   like. That is why the key must be a fine-grained token for this one repository
   (Contents: read and write) and the password must not be a short or common one.
   To change the password, run this again. To lock everyone out, delete the token on GitHub. */
import { webcrypto as crypto, randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";

// Everyday words, easy to read out and type on a phone.
const WORDS = "apple river stone garden window coffee bread candle bridge market forest silver yellow purple orange winter summer spring autumn morning evening sunset mountain valley desert island harbor village castle tower temple theatre street corner square garden kitchen table chair pillow blanket lantern mirror carpet basket bottle pocket button ribbon letter story music dance guitar violin piano drum camera picture colour paper pencil ticket journey travel ocean planet rocket comet meadow orchard pepper ginger honey lemon mango olive almond walnut cherry peach melon tomato carrot onion garlic butter cheese noodle pancake biscuit cookie sugar spice saffron jasmine tulip daisy lotus maple cedar willow bamboo falcon eagle sparrow pigeon rabbit turtle dolphin camel donkey monkey tiger zebra panda koala otter beetle cricket spider feather velvet cotton linen copper bronze marble crystal diamond emerald amber coral pearl shadow breeze thunder rainbow cloud storm frost ember flame smoke candle anchor compass saddle wagon tunnel ladder hammer needle thread quilt helmet jacket sandal scarf".split(" ").filter((w, i, a) => a.indexOf(w) === i).join(" ");
const REPO = "bristol-salalah/bristol-hotel-salalah";
const ITERATIONS = 600000;
const OUT = new URL("../admin/access.json", import.meta.url);
const args = process.argv.slice(2).filter((a) => a !== "--no-check");
const check = !process.argv.includes("--no-check"); // --no-check: don't ask GitHub whether the token works
const token = (process.env.BH_TOKEN || "").trim();
const login = (args[0] || "").trim().toLowerCase();
let password = args[1];

const stop = (msg) => { console.error(msg); process.exit(1); };
if (!login) stop("Usage: BH_TOKEN=github_pat_... node tools/make_login.mjs <login> [password]");
if (!token.startsWith("github_pat_")) stop("BH_TOKEN must be a fine-grained token (it starts with github_pat_). A classic or gh login token reaches every repository on the account and must never be published, even locked.");
if (!password) {
  const words = WORDS.split(" ");
  password = Array.from({ length: 4 }, () => words[randomInt(words.length)]).join("-") + "-" + randomInt(10, 100);
}
if (password.length < 12) stop("Choose a password of at least 12 characters, for example four words.");

if (check) {
  const res = await fetch(`https://api.github.com/repos/${REPO}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
  if (!res.ok) stop(`GitHub did not accept the token (${res.status}).`);
}

const b64 = (buf) => Buffer.from(buf).toString("base64");
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
const material = await crypto.subtle.importKey("raw", enc.encode(login + "\n" + password), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(token));
writeFileSync(OUT, JSON.stringify({ v: 1, iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) }, null, 1) + "\n");
console.log(`Wrote admin/access.json. Commit and push it.\n  Login:    ${login}\n  Password: ${password}`);
