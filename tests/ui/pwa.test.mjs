import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../../manifest.webmanifest", import.meta.url), "utf8"),
);
const indexHtml = await readFile(new URL("../../index.html", import.meta.url), "utf8");

const iconPath = (src) => new URL(`../../${src.replace(/^\//, "")}`, import.meta.url);

test("manifest declares installable PNG icons for Android", async () => {
  const declared = manifest.icons.map((icon) => `${icon.sizes}:${icon.purpose}`);
  assert.ok(manifest.icons.every((icon) => icon.type === "image/png"));
  assert.ok(declared.includes("192x192:any"), "192x192 any icon is required for install");
  assert.ok(declared.includes("512x512:any"), "512x512 any icon is required for install");
  assert.ok(declared.includes("512x512:maskable"), "a maskable icon is required for Android");
  for (const icon of manifest.icons) {
    const data = await readFile(iconPath(icon.src));
    assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${icon.src} is not a PNG`);
    const [width, height] = [data.readUInt32BE(16), data.readUInt32BE(20)];
    assert.equal(`${width}x${height}`, icon.sizes, `${icon.src} real size must match the manifest`);
  }
});

test("manifest keeps the Shinext install contract", () => {
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.theme_color, "#062d70");
  assert.equal(manifest.lang, "es-MX");
  assert.ok(manifest.shortcuts.length >= 3);
});

test("home page links the PNG favicon and the Apple touch icon", () => {
  assert.match(indexHtml, /rel="icon" href="\/brand\/shinext-icon-192\.png"/);
  assert.match(indexHtml, /rel="apple-touch-icon" href="\/brand\/apple-touch-icon-180\.png"/);
});

test("home page preloads only assets that exist", async () => {
  for (const match of indexHtml.matchAll(/<link rel="preload" as="image" href="([^"]+)"/g)) {
    const data = await readFile(iconPath(match[1]));
    assert.ok(data.length > 0, `${match[1]} is empty`);
  }
});
