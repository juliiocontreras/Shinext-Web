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
  authDomain: "demo-shinext-local.firebaseapp.com",
  projectId: "demo-shinext-local",
  storageBucket: "demo-shinext-local.appspot.com",
  appId: "1:123456789:web:demo-shinext-local",
};

async function loadFirebaseConfig() {
  if (isLocal) return localConfig;
  if (window.SHINEXT_FIREBASE_CONFIG) return window.SHINEXT_FIREBASE_CONFIG;

  const response = await fetch("/__/firebase/init.json", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(
      "Firebase Hosting no pudo proporcionar la configuración del proyecto.",
    );
  }

  return response.json();
}

const firebaseConfig = await loadFirebaseConfig();

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
