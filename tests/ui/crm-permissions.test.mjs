import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const js=await readFile(new URL("../../crm/crm.js",import.meta.url),"utf8");
const html=await readFile(new URL("../../crm/index.html",import.meta.url),"utf8");

test("CRM rejects worker role and exposes department-aware modules",()=>{
 assert.match(js,/role==="worker"/);
 assert.match(js,/director:\["dashboard","recruitment","operations","accounting","purchasing","sales"\]/);
 assert.match(js,/recruitment:\["dashboard","recruitment"\]/);
 assert.match(js,/accounting:\["dashboard","accounting"\]/);
});

test("CRM navigation honors permission grants and revokes",()=>{
 assert.match(js,/permissionGrants/);
 assert.match(js,/permissionRevokes/);
 assert.match(js,/manage_services:"operations"/);
 assert.match(js,/manage_supplies:"purchasing"/);
});

test("CRM keeps official Shinext logo asset",()=>{
 assert.match(html,/\/brand\/shinext-logo-original\.webp/);
});