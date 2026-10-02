import { auth, db } from "/assets/js/firebase-client.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const page = document.body.dataset.page;

function setStatus(element, message, kind = "") {
  if (!element) return;
  element.textContent = message;
  element.dataset.kind = kind;
}

async function getApprovedWorker(user) {
  const token = await user.getIdTokenResult(true);
  if (token.claims.role !== "worker") {
    throw new Error("Esta cuenta no pertenece al Portal del Trabajador.");
  }

  const workerSnapshot = await getDoc(doc(db, "workers", user.uid));
  if (!workerSnapshot.exists()) {
    throw new Error("Tu perfil de trabajador todavía no está disponible.");
  }

  const worker = workerSnapshot.data();
  if (worker.active !== true) {
    throw new Error("Tu acceso de trabajador no está activo.");
  }

  return worker;
}

function humanizeAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Correo o contraseña incorrectos.";
  }
  if (code.includes("too-many-requests")) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  }
  if (code.includes("network-request-failed")) {
    return "No pudimos conectar. Revisa tu internet e intenta otra vez.";
  }
  return error?.message || "No pudimos iniciar sesión.";
}

async function initLogin() {
  const form = document.querySelector("#worker-login-form");
  const status = document.querySelector("#login-status");
  const button = document.querySelector("#worker-login-button");

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    try {
      await getApprovedWorker(user);
      window.location.replace("/portal/");
    } catch {
      // Keep the user on the login screen if this account is not an approved worker.
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(status, "Verificando tu cuenta…");
    if (button) button.disabled = true;

    try {
      const email = String(form.email.value || "").trim().toLowerCase();
      const password = String(form.password.value || "");
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await getApprovedWorker(credential.user);
      setStatus(status, "Acceso correcto. Abriendo tu portal…", "success");
      window.location.replace("/portal/");
    } catch (error) {
      try { await signOut(auth); } catch {}
      setStatus(status, humanizeAuthError(error), "error");
      if (button) button.disabled = false;
    }
  });
}

function setView(viewName) {
  document.querySelectorAll("[data-view]").forEach((section) => {
    const active = section.dataset.view === viewName;
    section.hidden = !active;
    section.classList.toggle("active", active);
  });

  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    const active = button.dataset.navView === viewName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hydrateWorker(worker) {
  const name = document.querySelector("#worker-name");
  const zone = document.querySelector("#worker-zone");
  if (name) name.textContent = String(worker.fullName || "bienvenido").split(" ")[0];
  if (zone) zone.textContent = worker.zone ? `Zona registrada: ${worker.zone}` : "";
}

async function initPortal() {
  const loading = document.querySelector("#portal-loading");
  const app = document.querySelector("#portal-app");

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("/portal/login.html");
      return;
    }

    try {
      const worker = await getApprovedWorker(user);
      hydrateWorker(worker);
      if (loading) loading.hidden = true;
      if (app) app.hidden = false;
    } catch (error) {
      try { await signOut(auth); } catch {}
      sessionStorage.setItem("shinextPortalMessage", humanizeAuthError(error));
      window.location.replace("/portal/login.html");
    }
  });

  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("/portal/login.html");
  });

  document.querySelectorAll("[data-nav-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.navView));
  });

  document.querySelectorAll("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.goView));
  });

  document.querySelectorAll("[data-supply-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const status = document.querySelector("#supply-status");
      setStatus(status, "La solicitud detallada de insumos se habilitará en la siguiente entrega.", "info");
    });
  });
}

if (page === "login") {
  const message = sessionStorage.getItem("shinextPortalMessage");
  if (message) {
    setStatus(document.querySelector("#login-status"), message, "error");
    sessionStorage.removeItem("shinextPortalMessage");
  }
  initLogin();
} else if (page === "portal") {
  initPortal();
}
