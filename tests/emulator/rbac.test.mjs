import assert from "node:assert/strict";
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
    await setDoc(doc(db, "workers", "worker-a"), { displayName: "A" });
    await setDoc(doc(db, "workers", "worker-b"), { displayName: "B" });
    await setDoc(doc(db, "workerApplications", "candidate-1"), { status: "received" });
    await setDoc(doc(db, "collaborators", "recruiter-1"), {
      role: "recruitment",
      permissionGrants: [],
      permissionRevokes: [],
    });
    await setDoc(doc(db, "collaborators", "director-1"), {
      role: "director",
      permissionGrants: [],
      permissionRevokes: [],
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test("worker can read own profile but not another worker", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertSucceeds(getDoc(doc(workerDb, "workers", "worker-a")));
  await assertFails(getDoc(doc(workerDb, "workers", "worker-b")));
});

test("worker cannot read collaborator records", async () => {
  const workerDb = env.authenticatedContext("worker-a", { role: "worker" }).firestore();
  await assertFails(getDoc(doc(workerDb, "collaborators", "director-1")));
});

test("recruitment can read workers and candidate applications", async () => {
  const recruiterDb = env.authenticatedContext("recruiter-1", { role: "recruitment" }).firestore();

  await assertSucceeds(getDoc(doc(recruiterDb, "workers", "worker-a")));
  await assertSucceeds(getDoc(doc(recruiterDb, "workerApplications", "candidate-1")));
});

test("recruitment cannot change collaborator roles", async () => {
  const recruiterDb = env.authenticatedContext("recruiter-1", { role: "recruitment" }).firestore();

  await assertFails(
    setDoc(doc(recruiterDb, "collaborators", "recruiter-1"), {
      role: "director",
    }),
  );
});

test("director can manage collaborator records", async () => {
  const directorDb = env.authenticatedContext("director-1", { role: "director" }).firestore();

  await assertSucceeds(
    setDoc(doc(directorDb, "collaborators", "ops-1"), {
      role: "operations",
      permissionGrants: [],
      permissionRevokes: [],
    }),
  );

  const snapshot = await assertSucceeds(
    getDoc(doc(directorDb, "collaborators", "ops-1")),
  );
  assert.equal(snapshot.data()?.role, "operations");
});
