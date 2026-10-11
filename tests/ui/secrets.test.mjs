import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const repoRoot = new URL("../../", import.meta.url);
const TEXT_FILES = /\.(html|js|mjs|ts|json|css|md|txt|xml|yml|yaml|webmanifest|rules|toml)$/i;
const IGNORED_DIRS = new Set(["node_modules", ".git", "lib", ".firebase", ".tmp"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) files.push(...(await walk(child)));
    else files.push(child);
  }
  return files;
}

test("ningún archivo versionado contiene credenciales de Google", async () => {
  const files = await walk(repoRoot);
  assert.ok(files.length > 50, `se esperaban los archivos del repositorio, se recorrieron ${files.length}`);

  const offenders = [];
  for (const file of files) {
    if (!TEXT_FILES.test(file.pathname)) continue;
    const text = await readFile(file, "utf8");
    const name = file.pathname.split("/").pop();
    if (/AIza[0-9A-Za-z_-]{35}/.test(text)) offenders.push(`${name}: API key de Google`);
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) offenders.push(`${name}: clave privada`);
    if (/"private_key"\s*:\s*"-----/.test(text)) offenders.push(`${name}: private_key de service account`);
  }

  assert.deepEqual(offenders, [], `no se deben versionar credenciales: ${offenders.join(", ")}`);
});

test("la configuración de Firebase se obtiene de Hosting y no del repositorio", async () => {
  const files = await walk(repoRoot);
  for (const file of files) {
    if (!/\.(html|js|mjs)$/i.test(file.pathname)) continue;
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /apiKey:\s*"AIza/, `${file.pathname} incrusta una API key de proyecto`);
  }
});
