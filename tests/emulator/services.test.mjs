import { readFileSync } from "node:fs";
import test, { after, before } from "node:test";

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const projectId = process.env.GCLOUD_PROJECT || "shinext-local";
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portText] = emulatorHost.split(":");
const port = Number(portText || 8080);

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host,
      port,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "serviceRequests", "request-1"), {
      status: "offered",
      serviceType: "Casa",
    });

    await setDoc(doc(db, "serviceOffers", "offer-a"), {
      serviceRequestId: "request-1",
      workerUid: "worker-a",
      status: "pending",
      workerView: { workerEarning: 450 },
    });

    await setDoc(doc(db, "serviceOffers", "offer-b"), {
      serviceRequestId: "request-1",
      workerUid: "worker-b",
      status: "pending",
      workerView: { workerEarning: 450 },
    });

    await setDoc(doc(db, "services", "request-1"), {
      assignedWorkerUid: "worker-a",
      status: "scheduled",
      workerEarning: 450,
    });

    await setDoc(doc(db, "collaborators", "ops-1"), {
      role: "operations",
      permissionGrants: [],
      permissionRevokes: [],
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test("worker reads only their own service offers", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertSucceeds(getDoc(doc(workerDb, "serviceOffers", "offer-a")));
  await assertFails(getDoc(doc(workerDb, "serviceOffers", "offer-b")));
});

test("worker reads assigned service but not internal request", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertSucceeds(getDoc(doc(workerDb, "services", "request-1")));
  await assertFails(getDoc(doc(workerDb, "serviceRequests", "request-1")));
});

test("worker cannot mutate offer directly", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertFails(
    updateDoc(doc(workerDb, "serviceOffers", "offer-a"), {
      status: "accepted",
    }),
  );
});

test("operations can read requests, offers and services", async () => {
  const opsDb = env.authenticatedContext("ops-1", { role: "operations" }).firestore();

  await assertSucceeds(getDoc(doc(opsDb, "serviceRequests", "request-1")));
  await assertSucceeds(getDoc(doc(opsDb, "serviceOffers", "offer-a")));
  await assertSucceeds(getDoc(doc(opsDb, "services", "request-1")));
});
