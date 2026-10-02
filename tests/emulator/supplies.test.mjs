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
import {
  getBytes,
  ref,
  uploadBytes,
} from "firebase/storage";

const projectId = process.env.GCLOUD_PROJECT || "demo-shinext-local";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199";
const [firestoreHostname, firestorePortText] = firestoreHost.split(":");
const [storageHostname, storagePortText] = storageHost.split(":");

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: firestoreHostname,
      port: Number(firestorePortText || 8080),
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: storageHostname,
      port: Number(storagePortText || 9199),
      rules: readFileSync("storage.rules", "utf8"),
    },
  });

  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, "supplyRequests", "supply-a"), {
      workerUid: "worker-a",
      category: "cleaning_products",
      item: "Desengrasante",
      quantity: 1,
      status: "reported",
    });

    await setDoc(doc(db, "supplyRequests", "supply-b"), {
      workerUid: "worker-b",
      category: "uniform",
      item: "Playera",
      quantity: 1,
      status: "reported",
    });

    await setDoc(doc(db, "collaborators", "purchasing-1"), {
      role: "purchasing",
      permissionGrants: [],
      permissionRevokes: [],
    });
  });
});

after(async () => {
  await env?.cleanup();
});

test("worker reads only their own supply request and cannot transition it directly", async () => {
  const db = env.authenticatedContext("worker-a", { role: "worker" }).firestore();

  await assertSucceeds(getDoc(doc(db, "supplyRequests", "supply-a")));
  await assertFails(getDoc(doc(db, "supplyRequests", "supply-b")));
  await assertFails(
    updateDoc(doc(db, "supplyRequests", "supply-a"), {
      status: "delivered",
    }),
  );
});

test("purchasing reads supply requests but direct writes stay server-only", async () => {
  const db = env
    .authenticatedContext("purchasing-1", { role: "purchasing" })
    .firestore();

  await assertSucceeds(getDoc(doc(db, "supplyRequests", "supply-a")));
  await assertFails(
    updateDoc(doc(db, "supplyRequests", "supply-a"), {
      status: "reviewed",
    }),
  );
});

test("worker may upload own optional supply photo while other workers cannot read it", async () => {
  const ownerStorage = env
    .authenticatedContext("worker-a", { role: "worker" })
    .storage();

  const fileRef = ref(
    ownerStorage,
    "supply-requests/worker-a/supply-a/evidence.jpg",
  );

  await assertSucceeds(
    uploadBytes(fileRef, new Uint8Array([1, 2, 3, 4]), {
      contentType: "image/jpeg",
    }),
  );

  const otherStorage = env
    .authenticatedContext("worker-b", { role: "worker" })
    .storage();

  await assertFails(
    getBytes(
      ref(
        otherStorage,
        "supply-requests/worker-a/supply-a/evidence.jpg",
      ),
    ),
  );

  const purchasingStorage = env
    .authenticatedContext("purchasing-1", { role: "purchasing" })
    .storage();

  await assertSucceeds(
    getBytes(
      ref(
        purchasingStorage,
        "supply-requests/worker-a/supply-a/evidence.jpg",
      ),
    ),
  );
});
