import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const loader=await readFile(new URL("../../assets/js/content-loader.js",import.meta.url),"utf8");
const app=await readFile(new URL("../../app.js",import.meta.url),"utf8");
const article=await readFile(new URL("../../blog/limpieza-profunda-vs-mantenimiento/index.html",import.meta.url),"utf8");

test("blog article keeps static indexable content and adds managed media progressively",()=>{
  assert.match(article,/<article class="section-shell article">/);
  assert.match(article,/content-loader\.js/);
  assert.match(loader,/article\.article/);
  assert.match(loader,/article-video-preview/);
});

test("managed media uses provider allowlist and lazy iframe creation",()=>{
  assert.match(loader,/\["youtube", "tiktok"\]/);
  assert.match(loader,/iframe\.loading = "lazy"/);
  assert.match(loader,/replaceWith\(iframe\)/);
});

test("eligible YouTube media can emit VideoObject structured data",()=>{
  assert.match(loader,/"@type": "VideoObject"/);
  assert.match(loader,/thumbnailUrl/);
  assert.match(loader,/uploadDate/);
});

test("banner manager reads Firestore campaigns but preserves local fallback",()=>{
  assert.match(app,/window\.ShinextBanners/);
  assert.match(app,/collection\(db, 'bannerCampaigns'\)/);
  assert.match(app,/where\('active', '==', true\)/);
  assert.match(app,/Keep the local campaign fallback/);
});
