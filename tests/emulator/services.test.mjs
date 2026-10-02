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

    await setDoc(doc(db, "serviceNotes", "note-worker"), {
      serviceId: "request-1",
      authorUid: "worker-a",
      authorType: "worker",
      visibility: "worker",
      text: "Nota visible",
    });

    await setDoc(doc(db, "serviceNotes", "note-internal"), {
      serviceId: "request-1",
      authorUid: "ops-1",
      authorType: "collaborator",
      visibility: "internal_shinext",
      text: "Nota interna",
    });

    await setDoc(doc(db, "incidents", "incident-1"), {
      serviceId: "request-1",
      reporterUid: "worker-a",
      status: "open",
    });

    await setDoc(doc(db, "alerts", "alert-1"), {
      serviceId: "request-1",
      type: "service_incident",
      status: "open",
    });

    await setDoc(doc(db, "workerEarnings", "request-1"), {
      serviceId: "request-1",
      workerUid: "worker-a",
      amount: 450,
      currency: "MXN",
      paymentStatus: "pending",
    });

    await setDoc(doc(db, "workerEarnings", "request-2"), {
      serviceId: "request-2",
      workerUid: "worker-b",
      amount: 520,
      currency: "MXN",
      paymentStatus: "paid",
    });

    await setDoc(doc(db, "payments", "payment-1"), {
      serviceId: "request-1",
      workerUid: "worker-a",
      amount: 450,
      status: "pending",
    });

    await setDoc(doc(db, "collaborators", "ops-1"), {
      role: "operations",
      permissionGrants: [],
      permissionRevokes: [],
    });

    await setDoc(doc(db, "collaborators", "accounting-1"), {
      role: "accounting",
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


test("worker can read worker-visible note and own service incident, but not internal note or alert", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertSucceeds(getDoc(doc(workerDb, "serviceNotes", "note-worker")));
  await assertFails(getDoc(doc(workerDb, "serviceNotes", "note-internal")));
  await assertSucceeds(getDoc(doc(workerDb, "incidents", "incident-1")));
  await assertFails(getDoc(doc(workerDb, "alerts", "alert-1")));
});

test("operations can read service notes incidents and alerts", async () => {
  const opsDb = env.authenticatedContext("ops-1", { role: "operations" }).firestore();

  await assertSucceeds(getDoc(doc(opsDb, "serviceNotes", "note-worker")));
  await assertSucceeds(getDoc(doc(opsDb, "serviceNotes", "note-internal")));
  await assertSucceeds(getDoc(doc(opsDb, "incidents", "incident-1")));
  await assertSucceeds(getDoc(doc(opsDb, "alerts", "alert-1")));
});


test("worker reads only their own earning and cannot read internal payments", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertSucceeds(getDoc(doc(workerDb, "workerEarnings", "request-1")));
  await assertFails(getDoc(doc(workerDb, "workerEarnings", "request-2")));
  await assertFails(getDoc(doc(workerDb, "payments", "payment-1")));
});

test("worker cannot mutate earning or payment status directly", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertFails(
    updateDoc(doc(workerDb, "workerEarnings", "request-1"), {
      paymentStatus: "paid",
    }),
  );
});

test("accounting can read earnings and payments but not service operations by default", async () => {
  const accountingDb = env.authenticatedContext("accounting-1", { role: "accounting" }).firestore();

  await assertSucceeds(getDoc(doc(accountingDb, "workerEarnings", "request-1")));
  await assertSucceeds(getDoc(doc(accountingDb, "payments", "payment-1")));
  await assertFails(getDoc(doc(accountingDb, "serviceRequests", "request-1")));
});
