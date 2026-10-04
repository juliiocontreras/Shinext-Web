import assert from "node:assert/strict";

const rawBase = process.env.SHINEXT_BASE_URL || process.argv[2];
if (!rawBase) {
  throw new Error("Define SHINEXT_BASE_URL or pass the production URL as the first argument.");
}

const base = rawBase.replace(/\/$/, "");

async function get(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    redirect: "follow",
    ...options,
  });
  const text = await response.text();
  return { response, text };
}

async function expectHtml(path, pattern, label) {
  const { response, text } = await get(path);
  assert.equal(response.ok, true, `${label}: HTTP ${response.status}`);
  assert.match(text, pattern, `${label}: expected content was not found`);
}

await expectHtml("/", /Shinext/i, "home");
await expectHtml("/blog/", /Blog Shinext|Consejos de limpieza/i, "blog");
await expectHtml("/portal/", /Portal del Trabajador|Trabajador Shinext/i, "worker portal");
await expectHtml("/crm/", /Shinext CRM/i, "CRM shell");

const robots = await get("/robots.txt");
assert.equal(robots.response.ok, true, `robots.txt: HTTP ${robots.response.status}`);
assert.match(robots.text, /Disallow:\s*\/crm\//i, "robots.txt must disallow CRM");
assert.match(robots.text, /Disallow:\s*\/portal\//i, "robots.txt must disallow Worker Portal");

const firebaseInit = await get("/__/firebase/init.json", { cache: "no-store" });
assert.equal(firebaseInit.response.ok, true, `Firebase Hosting init: HTTP ${firebaseInit.response.status}`);
const firebaseConfig = JSON.parse(firebaseInit.text);
for (const key of ["apiKey", "authDomain", "projectId", "appId"]) {
  assert.equal(typeof firebaseConfig[key], "string", `Firebase config is missing ${key}`);
  assert.ok(firebaseConfig[key].length > 0, `Firebase config has empty ${key}`);
}
assert.equal(firebaseConfig.projectId.startsWith("demo-"), false, "Production must not use a demo Firebase project");

console.log(`Production smoke checks passed for ${base} (${firebaseConfig.projectId}).`);
