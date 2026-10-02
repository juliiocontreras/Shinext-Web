import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const articles=[
  "../../blog/limpieza-profunda-vs-mantenimiento/index.html",
  "../../blog/checklist-limpieza-airbnb-saltillo/index.html",
  "../../blog/limpieza-de-oficinas-en-saltillo/index.html",
];

for(const rel of articles){
  test(`${rel} contains core SEO metadata and Article schema`,async()=>{
    const html=await readFile(new URL(rel,import.meta.url),"utf8");
    assert.match(html,/<title>[^<]+<\/title>/);
    assert.match(html,/meta name="description" content="[^"]+"/);
    assert.match(html,/link rel="canonical" href="[^"]+"/);
    assert.match(html,/meta property="og:type" content="article"/);
    assert.match(html,/<h1>[^<]+<\/h1>/);
    assert.match(html,/"@type":"Article"/);
    assert.match(html,/Solicitar limpieza|Solicitar limpieza para/);
  });
}

test("production sitemap is deferred until a real Firebase or custom domain exists",async()=>{
  let sitemap="";
  try{sitemap=await readFile(new URL("../../sitemap.xml",import.meta.url),"utf8");}catch{}
  assert.doesNotMatch(sitemap,/example\.com|localhost|shinext-local/);
});
