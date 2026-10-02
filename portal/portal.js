import { auth, db, functions } from "/assets/js/firebase-client.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import {
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js";

const page = document.body.dataset.page;
const respondToOffer = httpsCallable(functions, "respondToOffer");

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

function humanizeError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Correo o contraseña incorrectos.";
  }
  if (code.includes("too-many-requests")) {
    return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  }
  if (code.includes("network-request-failed") || code.includes("unavailable")) {
    return "No pudimos conectar. Revisa tu internet e intenta otra vez.";
  }
  if (code.includes("already-exists")) {
    return "Este servicio ya fue cubierto por otro Trabajador Shinext.";
  }
  if (code.includes("failed-precondition")) {
    return "Esta solicitud ya no está disponible.";
  }
  return error?.message || "No pudimos completar la acción.";
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
      setStatus(status, humanizeError(error), "error");
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

function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function dateFrom(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = dateFrom(value);
  if (!date) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderOffers(offers) {
  const list = document.querySelector("#service-list");
  if (!list) return;

  const pending = offers.filter((offer) => offer.status === "pending");
  const count = document.querySelector("#pending-offers");
  if (count) count.textContent = String(pending.length);

  if (!offers.length) {
    list.replaceChildren();
    return;
  }

  list.innerHTML = offers.map((offer) => {
    const view = offer.workerView || {};
    const pendingActions = offer.status === "pending"
      ? `<div class="service-actions">
          <button class="offer-button accept" type="button" data-offer-action="accept" data-offer-id="${escapeHtml(offer.id)}">Aceptar</button>
          <button class="offer-button reject" type="button" data-offer-action="reject" data-offer-id="${escapeHtml(offer.id)}">Rechazar</button>
        </div>`
      : "";

    const statusLabel = {
      pending: "Por responder",
      accepted: "Aceptado",
      rejected: "Rechazado",
      covered: "Servicio cubierto",
      cancelled: "Cancelado",
    }[offer.status] || "Actualizado";

    return `<article class="worker-service-card" data-offer-card="${escapeHtml(offer.id)}">
      <div class="service-card-top">
        <span class="service-status status-${escapeHtml(offer.status)}">${statusLabel}</span>
        <strong class="service-pay">${formatMoney(view.workerEarning)}</strong>
      </div>
      <h3>${escapeHtml(view.serviceType || "Servicio de limpieza")}</h3>
      <dl class="service-details">
        <div><dt>Fecha</dt><dd>${escapeHtml(formatDate(view.scheduledAt))}</dd></div>
        <div><dt>Zona</dt><dd>${escapeHtml(view.zone || "Por confirmar")}</dd></div>
        <div><dt>Duración</dt><dd>${view.durationMinutes ? `${Number(view.durationMinutes)} min` : "Por confirmar"}</dd></div>
        <div><dt>Insumos</dt><dd>${escapeHtml(view.materialsProvider || "Por confirmar")}</dd></div>
      </dl>
      <div class="offer-feedback portal-status" aria-live="polite"></div>
      ${pendingActions}
    </article>`;
  }).join("");

  list.querySelectorAll("[data-offer-action]").forEach((button) => {
    button.addEventListener("click", handleOfferAction);
  });
}

function renderServices(services) {
  const upcoming = services
    .filter((service) => ["scheduled", "en_route", "started"].includes(service.status))
    .sort((a, b) => {
      const aDate = dateFrom(a.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bDate = dateFrom(b.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });

  const next = document.querySelector("#next-service");
  if (next) {
    next.textContent = upcoming.length
      ? `${upcoming[0].serviceType || "Limpieza"} · ${formatDate(upcoming[0].scheduledAt)}`
      : "Sin servicios programados";
  }
}

async function loadWorkerOperations(user) {
  const [offersSnapshot, servicesSnapshot] = await Promise.all([
    getDocs(query(collection(db, "serviceOffers"), where("workerUid", "==", user.uid))),
    getDocs(query(collection(db, "services"), where("assignedWorkerUid", "==", user.uid))),
  ]);

  const offers = offersSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => {
      const aDate = dateFrom(a.createdAt)?.getTime() || 0;
      const bDate = dateFrom(b.createdAt)?.getTime() || 0;
      return bDate - aDate;
    });

  const services = servicesSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));

  renderOffers(offers);
  renderServices(services);
}

async function handleOfferAction(event) {
  const button = event.currentTarget;
  const offerId = button.dataset.offerId;
  const decision = button.dataset.offerAction;
  const card = button.closest("[data-offer-card]");
  const feedback = card?.querySelector(".offer-feedback");
  const buttons = card?.querySelectorAll("[data-offer-action]") || [];

  buttons.forEach((item) => { item.disabled = true; });
  setStatus(
    feedback,
    decision === "accept" ? "Confirmando servicio…" : "Registrando respuesta…",
    "info",
  );

  try {
    await respondToOffer({ offerId, decision });
    setStatus(
      feedback,
      decision === "accept"
        ? "Servicio aceptado. Ya quedó agregado a tu agenda."
        : "Solicitud rechazada. Gracias por responder.",
      "success",
    );
    if (auth.currentUser) await loadWorkerOperations(auth.currentUser);
  } catch (error) {
    setStatus(feedback, humanizeError(error), "error");
    buttons.forEach((item) => { item.disabled = false; });
  }
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
      await loadWorkerOperations(user);
      if (loading) loading.hidden = true;
      if (app) app.hidden = false;
    } catch (error) {
      try { await signOut(auth); } catch {}
      sessionStorage.setItem("shinextPortalMessage", humanizeError(error));
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
