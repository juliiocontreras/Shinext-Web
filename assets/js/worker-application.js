import {
  signInAnonymously,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

import { auth, db, storage } from "./firebase-client.js";

const form = document.querySelector("#worker-application-form");
const submit = document.querySelector("#application-submit");
const statusBox = document.querySelector("#application-status");

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

function setStatus(message, kind = "info") {
  statusBox.textContent = message;
  statusBox.dataset.visible = "true";
  statusBox.dataset.kind = kind;
}

function validateFile(file, required) {
  if (!file && required) {
    throw new Error("Falta un documento obligatorio.");
  }
  if (!file) return;
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Usa únicamente archivos PDF, JPG o PNG.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Cada archivo debe pesar máximo 10 MB.");
  }
}

async function getApplicantUser() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

async function uploadDocument(applicationId, type, file, ownerUid) {
  if (!file) return null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const storageRef = ref(
    storage,
    `worker-applications/${applicationId}/${type}/${Date.now()}-${safeName}`,
  );

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      ownerUid,
      applicationId,
      documentType: type,
    },
  });

  return {
    path: storageRef.fullPath,
    name: file.name,
    contentType: file.type,
    size: file.size,
  };
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusBox.dataset.visible = "false";

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = new FormData(form);
  const identityFile = data.get("identityDocument");
  const addressFile = data.get("addressDocument");
  const studiesFile = data.get("studiesDocument");

  try {
    validateFile(identityFile, true);
    validateFile(addressFile, true);
    validateFile(studiesFile?.size ? studiesFile : null, false);

    submit.disabled = true;
    submit.textContent = "Enviando expediente…";
    setStatus("Protegiendo tus documentos y preparando tu solicitud…");

    const user = await getApplicantUser();
    const applicationRef = doc(collection(db, "workerApplications"));

    const baseApplication = {
      ownerUid: user.uid,
      fullName: String(data.get("fullName") || "").trim(),
      email: String(data.get("email") || "").trim().toLowerCase(),
      phone: String(data.get("phone") || "").trim(),
      zone: String(data.get("zone") || "").trim(),
      experience: String(data.get("experience") || ""),
      availability: String(data.get("availability") || ""),
      hasOwnSupplies: data.get("hasOwnSupplies") === "on",
      status: "received",
      documentsPending: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(applicationRef, baseApplication);

    const [identity, address, studies] = await Promise.all([
      uploadDocument(applicationRef.id, "identity", identityFile, user.uid),
      uploadDocument(applicationRef.id, "address", addressFile, user.uid),
      uploadDocument(
        applicationRef.id,
        "studies",
        studiesFile?.size ? studiesFile : null,
        user.uid,
      ),
    ]);

    await updateDoc(applicationRef, {
      documents: {
        identity,
        address,
        studies,
      },
      documentsPending: false,
      updatedAt: serverTimestamp(),
    });

    form.reset();
    setStatus(
      "Solicitud recibida. Reclutamiento Shinext revisará tu expediente y se pondrá en contacto contigo.",
      "success",
    );
  } catch (error) {
    console.error(error);
    setStatus(
      error?.message ||
        "No pudimos completar el envío. Revisa tu conexión e inténtalo nuevamente.",
      "error",
    );
  } finally {
    submit.disabled = false;
    submit.textContent = "Enviar mi solicitud";
  }
});
