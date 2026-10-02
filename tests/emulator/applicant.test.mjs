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
  serverTimestamp,
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
});

after(async () => {
  await env?.cleanup();
});

async function createApplication(uid = "applicant-a", id = "application-a") {
  const db = env.authenticatedContext(uid).firestore();
  const applicationRef = doc(db, "workerApplications", id);

  await assertSucceeds(
    setDoc(applicationRef, {
      ownerUid: uid,
      fullName: "Persona Aspirante",
      email: "aspirante@example.com",
      phone: "8440000000",
      zone: "Saltillo",
      experience: "1_3_years",
      availability: "both",
      hasOwnSupplies: false,
      status: "received",
      documentsPending: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );

  return applicationRef;
}

test("applicant owns the application but cannot approve it", async () => {
  const applicationRef = await createApplication();

  await assertSucceeds(getDoc(applicationRef));

  await assertFails(
    updateDoc(applicationRef, {
      status: "approved",
      updatedAt: serverTimestamp(),
    }),
  );

  await assertSucceeds(
    updateDoc(applicationRef, {
      documents: {
        identity: { path: "worker-applications/application-a/identity/id.pdf" },
        address: { path: "worker-applications/application-a/address/address.pdf" },
      },
      documentsPending: false,
      updatedAt: serverTimestamp(),
    }),
  );
});

test("another applicant cannot read someone else's application", async () => {
  await createApplication("applicant-owner", "private-application");

  const otherDb = env.authenticatedContext("applicant-other").firestore();
  await assertFails(
    getDoc(doc(otherDb, "workerApplications", "private-application")),
  );
});

test("expediente files are private to owner and recruitment reviewers", async () => {
  await createApplication("document-owner", "document-application");

  const ownerStorage = env.authenticatedContext("document-owner").storage();
  const fileRef = ref(
    ownerStorage,
    "worker-applications/document-application/identity/id.pdf",
  );

  await assertSucceeds(
    uploadBytes(fileRef, new Uint8Array([37, 80, 68, 70]), {
      contentType: "application/pdf",
    }),
  );

  const strangerStorage = env.authenticatedContext("stranger").storage();
  await assertFails(
    getBytes(
      ref(
        strangerStorage,
        "worker-applications/document-application/identity/id.pdf",
      ),
    ),
  );

  const recruiterStorage = env
    .authenticatedContext("recruiter-a", { role: "recruitment" })
    .storage();

  await assertSucceeds(
    getBytes(
      ref(
        recruiterStorage,
        "worker-applications/document-application/identity/id.pdf",
      ),
    ),
  );
});
