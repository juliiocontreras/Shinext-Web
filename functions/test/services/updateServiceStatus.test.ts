import assert from "node:assert/strict";
import test from "node:test";
import { HttpsError } from "firebase-functions/v2/https";
import { assertWorkerServiceTransition } from "../../src/services/updateServiceStatus.js";

test("worker service lifecycle advances in order",()=>{
 assert.equal(assertWorkerServiceTransition("scheduled","en_route"),"en_route");
 assert.equal(assertWorkerServiceTransition("en_route","started"),"started");
 assert.equal(assertWorkerServiceTransition("started","completed"),"completed");
});

test("worker cannot skip service stages or advance an incident",()=>{
 assert.throws(()=>assertWorkerServiceTransition("scheduled","completed"),(e:unknown)=>e instanceof HttpsError&&e.code==="failed-precondition");
 assert.throws(()=>assertWorkerServiceTransition("incident","completed"));
});
