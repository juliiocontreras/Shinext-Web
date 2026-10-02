import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  connectAuthEmulator,
  getAuth,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js";
import {
  connectStorageEmulator,
  getStorage,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

const localConfig = {
  apiKey: "demo-key",
  authDomain: "shinext-local.firebaseapp.com",
  projectId: "shinext-local",
  storageBucket: "shinext-local.appspot.com",
  appId: "1:123456789:web:shinext-local",
};

const firebaseConfig = window.SHINEXT_FIREBASE_CONFIG || (isLocal ? localConfig : null);

if (!firebaseConfig) {
  throw new Error(
    "Firebase todavía no está conectado a producción. Configura window.SHINEXT_FIREBASE_CONFIG.",
  );
}

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp, "us-central1");

if (isLocal && !window.__SHINEXT_FIREBASE_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  window.__SHINEXT_FIREBASE_EMULATORS_CONNECTED__ = true;
}
