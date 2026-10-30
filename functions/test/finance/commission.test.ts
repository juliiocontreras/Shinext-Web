import test from "node:test";
import assert from "node:assert/strict";
import {
  commissionRateForMode,
  calculateServiceEconomics,
} from "../../src/finance/commission.js";

test("independent providers keep 85 percent and Shinext keeps 15 percent", () => {
  assert.equal(commissionRateForMode("independent"), 0.15);
  assert.deepEqual(calculateServiceEconomics(1000, "independent"), {
    clientPrice: 1000,
    commissionRate: 0.15,
    shinextCommission: 150,
    workerEarning: 850,
  });
});

test("Shinext Partners keep 80 percent and Shinext keeps 20 percent", () => {
  assert.equal(commissionRateForMode("shinext_partner"), 0.2);
  assert.deepEqual(calculateServiceEconomics(1000, "shinext_partner"), {
    clientPrice: 1000,
    commissionRate: 0.2,
    shinextCommission: 200,
    workerEarning: 800,
  });
});
