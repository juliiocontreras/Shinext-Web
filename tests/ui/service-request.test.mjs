import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html=await readFile(new URL("../../solicitar/index.html",import.meta.url),"utf8");
const js=await readFile(new URL("../../assets/js/service-request.js",import.meta.url),"utf8");
const rules=await readFile(new URL("../../firestore.rules",import.meta.url),"utf8");
const manifest=await readFile(new URL("../../manifest.webmanifest",import.meta.url),"utf8");

test("public request flow is mobile-first and captures matching fields",()=>{
  for(const field of ["serviceType","cleaningLevel","zone","requestedDate","timeWindow","spaceSize","frequency","suppliesSource","clientName","clientPhone"]){
    assert.match(html,new RegExp(`name=["']${field}["']`));
  }
  assert.match(html,/viewport-fit=cover/);
});

test("public request authenticates anonymously and writes a new lead",()=>{
  assert.match(js,/signInAnonymously/);
  assert.match(js,/collection\(db, "serviceRequests"\)/);
  assert.match(js,/status:\s*"new"/);
  assert.match(js,/dispatchStatus:\s*"pending"/);
});

test("firestore only permits tightly-shaped owner-created public leads",()=>{
  assert.match(rules,/validPublicServiceRequestCreate/);
  assert.match(rules,/request\.resource\.data\.ownerUid == request\.auth\.uid/);
  assert.match(rules,/allow create: if validPublicServiceRequestCreate\(\)/);
  assert.match(rules,/allow update, delete: if false/);
});

test("PWA exposes direct request shortcut",()=>{
  assert.match(manifest,/"url":"\/solicitar\/"/);
});
