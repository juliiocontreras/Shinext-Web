import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const PRODUCTION_ORIGIN = "https://shinext.site";
const OG_IMAGE = `${PRODUCTION_ORIGIN}/brand/shinext-og.png`;

// Todas las rutas publicas indexables del sitio.
const publicPages = [
  ["../../index.html", "/"],
  ["../../trabaja/index.html", "/trabaja/"],
  ["../../blog/index.html", "/blog/"],
  ["../../blog/limpieza-profunda-vs-mantenimiento/index.html", "/blog/limpieza-profunda-vs-mantenimiento/"],
  ["../../blog/checklist-limpieza-airbnb-saltillo/index.html", "/blog/checklist-limpieza-airbnb-saltillo/"],
  ["../../blog/limpieza-de-oficinas-en-saltillo/index.html", "/blog/limpieza-de-oficinas-en-saltillo/"],
];

const articles = publicPages.filter(([, path]) => path.startsWith("/blog/") && path !== "/blog/");

for (const [rel, path] of publicPages) {
  test(`${rel} uses absolute production canonical and social metadata`, async () => {
    const html = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /meta name="description" content="[^"]+"/);
    assert.ok(
      html.includes(`<link rel="canonical" href="${PRODUCTION_ORIGIN}${path}"`),
      `canonical must be absolute on ${PRODUCTION_ORIGIN}`,
    );
    assert.ok(
      html.includes(`property="og:url" content="${PRODUCTION_ORIGIN}${path}"`),
      "og:url must be absolute",
    );
    assert.ok(html.includes(`property="og:image" content="${OG_IMAGE}"`), "og:image must be the 1200x630 asset");
    assert.match(html, /<h1[ >]/);
  });
}

for (const [rel] of articles) {
  test(`${rel} exposes Article structured data`, async () => {
    const html = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.match(html, /meta property="og:type" content="article"/);
    assert.match(html, /"@type":"Article"/);
    assert.match(html, /Solicitar limpieza|Solicitar limpieza para/);
  });
}

test("public pages never advertise a placeholder origin", async () => {
  for (const [rel] of publicPages) {
    const html = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.doesNotMatch(html, /rel="canonical" href="\/[^"]/, `${rel} still has a relative canonical`);
    assert.doesNotMatch(html, /web\.app|example\.com|localhost/, `${rel} must not reference placeholder origins`);
  }
});

test("production sitemap lists exactly the public pages on the production domain", async () => {
  const sitemap = await readFile(new URL("../../sitemap.xml", import.meta.url), "utf8");
  assert.doesNotMatch(sitemap, /example\.com|localhost|shinext-local|web\.app/);
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locs, publicPages.map(([, path]) => `${PRODUCTION_ORIGIN}${path}`));
});

test("robots.txt advertises the sitemap and keeps private areas out of the index", async () => {
  const robots = await readFile(new URL("../../robots.txt", import.meta.url), "utf8");
  assert.match(robots, /Sitemap: https:\/\/shinext\.site\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/crm\//);
  assert.match(robots, /Disallow: \/portal\//);
});

test("private shells stay noindex", async () => {
  for (const rel of ["../../portal/index.html", "../../portal/login.html", "../../crm/index.html", "../../crm/login.html"]) {
    const html = await readFile(new URL(rel, import.meta.url), "utf8");
    assert.match(html, /name="robots" content="noindex, nofollow"/);
  }
});
