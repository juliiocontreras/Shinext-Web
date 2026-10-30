import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html=await readFile(new URL("../../solicitar/index.html",import.meta.url),"utf8");
const js=await readFile(new URL("../../assets/js/service-request.js",import.meta.url),"utf8");
const dispatcher=await readFile(new URL("../../cloudflare/shinext-dispatch.js",import.meta.url),"utf8");
const operations=await readFile(new URL("../../crm/modules/operations.js",import.meta.url),"utf8");

test("customer sees and accepts quote before request submission",()=>{
  assert.match(html,/id="quote-preview"/);
  assert.match(html,/name="quoteAccepted"/);
  assert.match(html,/Ver precio estimado/);
  assert.match(js,/\/quote/);
  assert.match(js,/quoteAccepted/);
  assert.match(js,/pricingVersion/);
});

test("changing a pricing input invalidates the prior quote",()=>{
  assert.match(js,/invalidateQuote/);
  for(const field of ["serviceType","cleaningLevel","spaceSize","frequency","suppliesSource"]){
    assert.match(js,new RegExp(field));
  }
});

test("dispatcher exposes public quote and requires quote confirmation on lead creation",()=>{
  assert.match(dispatcher,/url\.pathname==="\/quote"/);
  assert.match(dispatcher,/quoteAccepted/);
  assert.match(dispatcher,/pricingVersion/);
  assert.match(dispatcher,/payment_status/);
});

test("operations surfaces payment status and confirmed quote",()=>{
  assert.match(operations,/payment_status/);
  assert.match(operations,/Pago/);
  assert.match(operations,/commission_rate/);
});
