import test from "node:test";
import assert from "node:assert/strict";
import { quoteCleaningService } from "../../src/pricing/quote.mjs";

test("independent service keeps 15 percent platform commission",()=>{
  const q=quoteCleaningService({
    serviceType:"home",
    cleaningLevel:"maintenance",
    spaceSize:"small",
    frequency:"once",
    suppliesSource:"provider",
  });
  assert.equal(q.commissionRate,0.15);
  assert.equal(q.workerEarning,Math.round(q.clientPrice*0.85));
});

test("Shinext supplied service keeps 20 percent platform commission",()=>{
  const q=quoteCleaningService({
    serviceType:"home",
    cleaningLevel:"maintenance",
    spaceSize:"small",
    frequency:"once",
    suppliesSource:"shinext",
  });
  assert.equal(q.commissionRate,0.2);
  assert.equal(q.workerEarning,Math.round(q.clientPrice*0.8));
});

test("deep and larger services cost more than small maintenance",()=>{
  const small=quoteCleaningService({serviceType:"home",cleaningLevel:"maintenance",spaceSize:"small",frequency:"once",suppliesSource:"provider"});
  const deep=quoteCleaningService({serviceType:"home",cleaningLevel:"deep",spaceSize:"large",frequency:"once",suppliesSource:"provider"});
  assert.ok(deep.clientPrice>small.clientPrice);
});

test("recurring service gets a customer discount without changing commission percentage",()=>{
  const once=quoteCleaningService({serviceType:"home",cleaningLevel:"maintenance",spaceSize:"small",frequency:"once",suppliesSource:"provider"});
  const weekly=quoteCleaningService({serviceType:"home",cleaningLevel:"maintenance",spaceSize:"small",frequency:"weekly",suppliesSource:"provider"});
  assert.ok(weekly.clientPrice<once.clientPrice);
  assert.equal(weekly.commissionRate,0.15);
});
