import { auth, db, firebaseCapabilities, functions, storage } from "/assets/js/firebase-client.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import {
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js";
import {
  ref as storageRef,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

const page = document.body.dataset.page;
const PROVIDER_API = "https://shinext-provider.juliiocontreras.workers.dev";

async function providerFetch(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Inicia sesión para continuar.");
  const token = await user.getIdToken();
  const response = await fetch(`${PROVIDER_API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "No pudimos completar la acción.");
  return body;
}

function sparkSafeCallable(name) {
  const invoke = httpsCallable(functions, name);
  return async (payload) => {
    if (!firebaseCapabilities.functions) {
      const error = new Error(
        "Esta acción está temporalmente deshabilitada mientras Shinext opera en modo gratuito de Firebase.",
      );
      error.code = "shinext/spark-mode";
      throw error;
    }
    return invoke(payload);
  };
}

const respondToOffer = sparkSafeCallable("respondToOffer");
const addServiceNote = sparkSafeCallable("addServiceNote");
const reportIncident = sparkSafeCallable("reportIncident");
const createSupplyRequest = sparkSafeCallable("createSupplyRequest");
const updateSupplyRequest = sparkSafeCallable("updateSupplyRequest");
const updateServiceStatus = sparkSafeCallable("updateServiceStatus");

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
  if (code.includes("shinext/spark-mode")) {
    return "Esta acción no está disponible por ahora en modo gratuito de Firebase.";
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
  const modeBadge = document.querySelector("#worker-mode-badge");
  const supplyHelper = document.querySelector("#supply-mode-helper");
  const partner = worker.serviceMode === "shinext_partner";
  document.body.dataset.providerMode = partner ? "shinext_partner" : "independent";
  const supplyGrid = document.querySelector(".supply-grid");
  if (supplyGrid) supplyGrid.hidden = !partner;
  if (name) name.textContent = String(worker.fullName || "bienvenido").split(" ")[0];
  if (zone) zone.textContent = worker.zone ? `Zona registrada: ${worker.zone}` : "";
  if (modeBadge) modeBadge.textContent = partner ? "Shinext Partner · 80%" : "Independiente · 85%";
  if (supplyHelper) {
    supplyHelper.textContent = partner
      ? "Shinext provee tus insumos. Reporta aquí cualquier faltante antes de tu siguiente servicio."
      : "Tú provees tus insumos. Usa el checklist para preparar cada servicio; las solicitudes a Compras están reservadas para Shinext Partners.";
  }
  document.querySelectorAll("[data-supply-category]").forEach(button => {
    button.disabled = !partner;
  });
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
  const actionablePending = pending.filter((offer) => Number(offer.workerView?.workerEarning || 0) > 0);
  const count = document.querySelector("#pending-offers");
  const empty = document.querySelector("#offers-empty");
  if (count) count.textContent = String(actionablePending.length);
  if (empty) empty.hidden = offers.length > 0;

  if (!offers.length) {
    list.replaceChildren();
    return;
  }

  list.innerHTML = offers.map((offer) => {
    const view = offer.workerView || {};
    const canAccept = Number(view.workerEarning || 0) > 0;
    const pendingActions = offer.status === "pending"
      ? `<div class="service-actions">
          ${canAccept ? `<button class="offer-button accept" type="button" data-offer-action="accept" data-offer-id="${escapeHtml(offer.id)}" data-offer-backend="${escapeHtml(offer.backend || "firebase")}">Aceptar</button>` : ""}
          <button class="offer-button reject" type="button" data-offer-action="reject" data-offer-id="${escapeHtml(offer.id)}" data-offer-backend="${escapeHtml(offer.backend || "firebase")}">No me interesa</button>
        </div>`
      : "";

    const statusLabel = {
      pending: canAccept ? "Por responder" : "En preparación",
      accepted: "Aceptado",
      rejected: "Rechazado",
      covered: "Servicio cubierto",
      cancelled: "Cancelado",
    }[offer.status] || "Actualizado";

    return `<article class="worker-service-card" data-offer-card="${escapeHtml(offer.id)}">
      <div class="service-card-top">
        <span class="service-status status-${escapeHtml(offer.status)}">${statusLabel}</span>
        <strong class="service-pay">${canAccept ? formatMoney(view.workerEarning) : "Pago por confirmar"}</strong>
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

function renderEarnings(earnings) {
  const total = earnings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const paid = earnings
    .filter((item) => item.paymentStatus === "paid")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = total - paid;

  const totalNode = document.querySelector("#earning-total");
  const paidNode = document.querySelector("#earning-paid");
  const pendingNode = document.querySelector("#earning-pending");
  const homePending = document.querySelector("#pending-earnings");
  const empty = document.querySelector("#earnings-empty");
  const list = document.querySelector("#earnings-list");

  if (totalNode) totalNode.textContent = formatMoney(total);
  if (paidNode) paidNode.textContent = formatMoney(paid);
  if (pendingNode) pendingNode.textContent = formatMoney(pending);
  if (homePending) homePending.textContent = formatMoney(pending);

  if (!list || !empty) return;

  empty.hidden = earnings.length > 0;
  list.innerHTML = earnings.map((earning) => {
    const paidStatus = earning.paymentStatus === "paid";
    return `<article class="earning-row">
      <div>
        <small>Servicio</small>
        <strong>${escapeHtml(earning.serviceId || earning.id)}</strong>
      </div>
      <div>
        <small>Estado</small>
        <span class="earning-status ${paidStatus ? "paid" : "pending"}">${paidStatus ? "Pagado" : "Pendiente"}</span>
      </div>
      <strong class="earning-amount">${formatMoney(earning.amount)}</strong>
    </article>`;
  }).join("");
}

function renderSupplyRequests(requests) {
  const list = document.querySelector("#supply-history");
  if (!list) return;

  if (!requests.length) {
    list.replaceChildren();
    return;
  }

  const categoryLabel = {
    cleaning_products: "Productos de limpieza",
    tools: "Herramientas",
    uniform: "Uniforme",
  };

  const statusLabel = {
    reported: "Reportado",
    reviewed: "Revisado",
    preparing_purchasing: "Preparando / comprando",
    ready_for_delivery: "Listo para entrega",
    delivered: "Entregado",
  };

  list.innerHTML = requests.map((item) => `<article class="supply-history-row">
    <div>
      <small>${escapeHtml(categoryLabel[item.category] || "Insumo")}</small>
      <strong>${escapeHtml(item.item || "Solicitud")}</strong>
      <span>Cantidad: ${Number(item.quantity || 1)}</span>
    </div>
    <span class="supply-history-status status-${escapeHtml(item.status || "reported")}">${escapeHtml(statusLabel[item.status] || "Reportado")}</span>
  </article>`).join("");
}

function renderCalendar(services) {
  const list = document.querySelector("#calendar-list");
  if (!list) return;
  const upcoming = services
    .filter((service) => ["scheduled", "en_route", "started", "incident"].includes(service.status))
    .sort((a, b) => {
      const aDate = dateFrom(a.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bDate = dateFrom(b.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });

  if (!upcoming.length) {
    list.innerHTML = '<div class="calendar-placeholder"><span aria-hidden="true">▦</span><strong>Sin servicios programados</strong><p>Cuando tengas un servicio confirmado aparecerá aquí.</p></div>';
    return;
  }

  list.innerHTML = upcoming.map((service) => {
    const date = dateFrom(service.scheduledAt);
    const day = date ? new Intl.DateTimeFormat("es-MX",{day:"2-digit"}).format(date) : "--";
    const month = date ? new Intl.DateTimeFormat("es-MX",{month:"short"}).format(date) : "";
    const time = date ? new Intl.DateTimeFormat("es-MX",{hour:"numeric",minute:"2-digit"}).format(date) : "Por confirmar";
    return `<article class="calendar-service">
      <div class="calendar-date"><strong>${day}</strong><span>${escapeHtml(month)}</span></div>
      <div><small>${escapeHtml(time)}</small><strong>${escapeHtml(service.serviceType || "Servicio de limpieza")}</strong><span>${escapeHtml(service.zone || "Zona por confirmar")}</span></div>
    </article>`;
  }).join("");
}

function renderCompletedServices(services) {
  const list = document.querySelector("#completed-service-list");
  if (!list) return;
  const completed = services
    .filter((service) => service.status === "completed")
    .sort((a, b) => {
      const aDate = dateFrom(a.completedAt || a.scheduledAt)?.getTime() || 0;
      const bDate = dateFrom(b.completedAt || b.scheduledAt)?.getTime() || 0;
      return bDate - aDate;
    });

  if (!completed.length) {
    list.innerHTML = '<div class="notice-card"><strong>Aún no hay servicios finalizados.</strong><span>Tu historial aparecerá aquí después de completar servicios.</span></div>';
    return;
  }

  list.innerHTML = completed.map((service) => `<article class="worker-service-card completed-card">
    <div class="service-card-top">
      <span class="service-status status-accepted">Finalizado</span>
      <strong class="service-pay">${formatMoney(service.workerEarning)}</strong>
    </div>
    <h3>${escapeHtml(service.serviceType || "Servicio de limpieza")}</h3>
    <dl class="service-details">
      <div><dt>Fecha</dt><dd>${escapeHtml(formatDate(service.completedAt || service.scheduledAt))}</dd></div>
      <div><dt>Zona</dt><dd>${escapeHtml(service.zone || "Por confirmar")}</dd></div>
    </dl>
  </article>`).join("");
}

function renderServices(services) {
  const list = document.querySelector("#confirmed-service-list");
  const upcoming = services
    .filter((service) => ["scheduled", "en_route", "started", "incident"].includes(service.status))
    .sort((a, b) => {
      const aDate = dateFrom(a.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
      const bDate = dateFrom(b.scheduledAt)?.getTime() || Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });

  renderCalendar(services);
  renderCompletedServices(services);

  const next = document.querySelector("#next-service");
  if (next) {
    next.textContent = upcoming.length
      ? `${upcoming[0].serviceType || "Limpieza"} · ${formatDate(upcoming[0].scheduledAt)}`
      : "Sin servicios programados";
  }

  if (!list) return;

  if (!upcoming.length) {
    list.innerHTML = `<div class="notice-card"><strong>No tienes servicios confirmados.</strong><span>Cuando aceptes uno, aparecerá aquí con sus acciones de seguimiento.</span></div>`;
    return;
  }

  list.innerHTML = upcoming.map((service) => {
    const statusLabel = {
      scheduled: "Programado",
      en_route: "En camino",
      started: "Iniciado",
      incident: "Incidencia reportada",
    }[service.status] || "Activo";

    const progress = {
      scheduled: { next: "en_route", label: "Voy en camino" },
      en_route: { next: "started", label: "Iniciar servicio" },
      started: { next: "completed", label: "Finalizar servicio" },
    }[service.status] || null;

    return `<article class="worker-service-card confirmed-card" data-service-card="${escapeHtml(service.id)}">
      <div class="service-card-top">
        <span class="service-status status-${escapeHtml(service.status)}">${statusLabel}</span>
        <strong class="service-pay">${formatMoney(service.workerEarning)}</strong>
      </div>
      <h3>${escapeHtml(service.serviceType || "Servicio de limpieza")}</h3>
      <dl class="service-details">
        <div><dt>Fecha</dt><dd>${escapeHtml(formatDate(service.scheduledAt))}</dd></div>
        <div><dt>Zona</dt><dd>${escapeHtml(service.zone || "Por confirmar")}</dd></div>
        <div><dt>Dirección</dt><dd>${escapeHtml(service.fullAddress || "Se mostrará cuando esté disponible")}</dd></div>
        <div><dt>Contacto</dt><dd>${escapeHtml(service.clientContactName || service.clientContactPhone || "Por confirmar")}</dd></div>
      </dl>
      ${service.instructions ? `<p class="service-instructions"><strong>Indicaciones:</strong> ${escapeHtml(service.instructions)}</p>` : ""}
      ${progress ? `<button type="button" class="service-progress-button" data-service-progress="${progress.next}" data-service-id="${escapeHtml(service.id)}">${progress.label}</button>` : ""}
      <div class="service-followup-actions">
        <button type="button" class="offer-button note" data-service-action="note" data-service-id="${escapeHtml(service.id)}">Agregar nota</button>
        <button type="button" class="offer-button incident" data-service-action="incident" data-service-id="${escapeHtml(service.id)}">Reportar incidencia</button>
      </div>
      <div class="service-feedback portal-status" aria-live="polite"></div>
    </article>`;
  }).join("");

  list.querySelectorAll("[data-service-action]").forEach((button) => {
    button.addEventListener("click", handleServiceFollowup);
  });
  list.querySelectorAll("[data-service-progress]").forEach((button) => {
    button.addEventListener("click", handleServiceProgress);
  });
}

function renderSupplyChecklists(checklists) {
  const root = document.querySelector("#service-supply-checklist");
  if (!root) return;
  const active = checklists.filter(item => item.active !== false);
  root.innerHTML = active.length
    ? active.map(item => `<article class="checklist-entry"><strong>${escapeHtml(item.title || item.serviceType || "Checklist")}</strong><small>${escapeHtml(item.serviceType || "Servicio de limpieza")}</small><ul>${(Array.isArray(item.items) ? item.items : []).map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul></article>`).join("")
    : '<p class="section-helper">Compras todavía no ha publicado checklists.</p>';
}

async function loadWorkerOperations(user) {
  const cloudOffersPromise = providerFetch("/offers").catch(() => ({ offers: [] }));
  const [offersSnapshot, servicesSnapshot, earningsSnapshot, suppliesSnapshot, checklistSnapshot, cloudOfferResult] = await Promise.all([
    getDocs(query(collection(db, "serviceOffers"), where("workerUid", "==", user.uid))),
    getDocs(query(collection(db, "services"), where("assignedWorkerUid", "==", user.uid))),
    getDocs(query(collection(db, "workerEarnings"), where("workerUid", "==", user.uid))),
    getDocs(query(collection(db, "supplyRequests"), where("workerUid", "==", user.uid))),
    getDocs(collection(db, "supplyChecklists")),
  ]);

  const firebaseOffers = offersSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data(), backend: "firebase" }));
  const cloudOffers = (cloudOfferResult.offers || []).map((offer) => ({
    id: offer.id,
    status: offer.status,
    backend: "cloudflare",
    workerView: {
      serviceType: offer.service_type,
      zone: offer.zone,
      scheduledAt: offer.requested_date,
      durationMinutes: 0,
      materialsProvider: offer.supplies_source === "shinext" ? "Shinext" : "Prestador",
      workerEarning: Number(offer.worker_earning || 0),
      clientPrice: Number(offer.client_price || 0),
    },
  }));
  const offers = [...cloudOffers, ...firebaseOffers]
    .sort((a, b) => {
      const aDate = dateFrom(a.createdAt)?.getTime() || 0;
      const bDate = dateFrom(b.createdAt)?.getTime() || 0;
      return bDate - aDate;
    });

  const services = servicesSnapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));

  const earnings = earningsSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => {
      const aDate = dateFrom(a.generatedAt)?.getTime() || 0;
      const bDate = dateFrom(b.generatedAt)?.getTime() || 0;
      return bDate - aDate;
    });

  const supplies = suppliesSnapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .sort((a, b) => {
      const aDate = dateFrom(a.createdAt)?.getTime() || 0;
      const bDate = dateFrom(b.createdAt)?.getTime() || 0;
      return bDate - aDate;
    });

  renderOffers(offers);
  renderServices(services);
  renderEarnings(earnings);
  renderSupplyRequests(supplies);
  renderSupplyChecklists(checklistSnapshot.docs.map(document => ({ id: document.id, ...document.data() })));
}

async function handleOfferAction(event) {
  const button = event.currentTarget;
  const offerId = button.dataset.offerId;
  const decision = button.dataset.offerAction;
  const backend = button.dataset.offerBackend || "firebase";
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
    if (backend === "cloudflare") {
      await providerFetch(`/offers/${encodeURIComponent(offerId)}/respond`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
    } else {
      await respondToOffer({ offerId, decision });
    }
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


async function handleServiceProgress(event) {
  const button = event.currentTarget;
  const serviceId = button.dataset.serviceId;
  const nextStatus = button.dataset.serviceProgress;
  const card = button.closest("[data-service-card]");
  const feedback = card?.querySelector(".service-feedback");

  const confirmation = {
    en_route: "¿Confirmas que vas en camino al servicio?",
    started: "¿Confirmas que ya iniciaste el servicio?",
    completed: "¿Confirmas que terminaste el servicio?",
  }[nextStatus] || "¿Confirmas este cambio?";

  if (!window.confirm(confirmation)) return;

  button.disabled = true;
  setStatus(feedback, "Actualizando servicio…", "info");

  try {
    await updateServiceStatus({ serviceId, status: nextStatus });
    setStatus(
      feedback,
      nextStatus === "completed"
        ? "Servicio marcado como finalizado. Shinext validará el cierre y tu ganancia."
        : "Estado actualizado.",
      "success",
    );
    if (auth.currentUser) await loadWorkerOperations(auth.currentUser);
  } catch (error) {
    setStatus(feedback, humanizeError(error), "error");
    button.disabled = false;
  }
}

async function handleServiceFollowup(event) {
  const button = event.currentTarget;
  const serviceId = button.dataset.serviceId;
  const action = button.dataset.serviceAction;
  const card = button.closest("[data-service-card]");
  const feedback = card?.querySelector(".service-feedback");
  const buttons = card?.querySelectorAll("[data-service-action]") || [];

  const promptText = action === "incident"
    ? "Describe qué ocurrió. Esta incidencia será enviada a Operaciones Shinext."
    : "Escribe una nota breve para dejar contexto de este servicio.";
  const text = window.prompt(promptText);
  if (!text || !text.trim()) return;

  buttons.forEach((item) => { item.disabled = true; });
  setStatus(
    feedback,
    action === "incident" ? "Enviando incidencia…" : "Guardando nota…",
    "info",
  );

  try {
    if (action === "incident") {
      await reportIncident({ serviceId, description: text.trim() });
      setStatus(
        feedback,
        "Incidencia enviada. Operaciones Shinext ya puede darle seguimiento.",
        "success",
      );
    } else {
      await addServiceNote({
        serviceId,
        text: text.trim(),
        visibility: "worker",
      });
      setStatus(feedback, "Nota guardada en la bitácora del servicio.", "success");
    }

    if (auth.currentUser) await loadWorkerOperations(auth.currentUser);
  } catch (error) {
    setStatus(feedback, humanizeError(error), "error");
  } finally {
    buttons.forEach((item) => { item.disabled = false; });
  }
}


function buildAvailabilityEditor() {
  const root = document.querySelector("#availability-grid");
  if (!root || root.dataset.ready === "true") return;
  const days = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const windows = [
    ["morning","Mañana"],
    ["afternoon","Tarde"],
    ["evening","Noche"],
  ];
  root.innerHTML = days.map((day, weekday) => `
    <div class="availability-day">
      <strong>${day}</strong>
      ${windows.map(([value,label]) => `<label class="availability-slot"><input type="checkbox" data-availability-weekday="${weekday}" data-availability-window="${value}"><span>${label}</span></label>`).join("")}
    </div>`
  ).join("");
  root.dataset.ready = "true";
}

async function hydrateProviderReputation() {
  const badge=document.querySelector("#provider-rating");
  if(!badge) return;
  try{
    const summary=await providerFetch("/me");
    const rating=Number(summary.rating||0);
    const completed=Number(summary.completed_services||0);
    badge.textContent=completed>0 ? `${rating.toFixed(1)}★ · ${completed} calificación(es)` : "Sin calificaciones";
  }catch{
    badge.textContent="Reputación pendiente";
  }
}

async function syncProviderProfile(worker) {
  await providerFetch("/profile", {
    method: "POST",
    body: JSON.stringify({
      displayName: worker.fullName || "",
      zone: worker.zone || "",
      serviceMode: worker.serviceMode || "independent",
      serviceTypes: Array.isArray(worker.serviceTypes) && worker.serviceTypes.length ? worker.serviceTypes : ["all"],
    }),
  });
}

async function saveProviderAvailability(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.querySelector("#availability-status");
  const button = document.querySelector("#availability-save");
  const slots = [...form.querySelectorAll("[data-availability-weekday]")].map(input => ({
    weekday: Number(input.dataset.availabilityWeekday),
    timeWindow: input.dataset.availabilityWindow,
    available: input.checked,
  })).filter(slot => slot.available);
  if (button) button.disabled = true;
  setStatus(status, "Guardando disponibilidad…", "info");
  try {
    await providerFetch("/availability", {
      method: "POST",
      body: JSON.stringify({ slots }),
    });
    setStatus(status, "Disponibilidad guardada. El bot ya puede considerarla para nuevas solicitudes.", "success");
  } catch (error) {
    setStatus(status, humanizeError(error), "error");
  } finally {
    if (button) button.disabled = false;
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
      buildAvailabilityEditor();
      await syncProviderProfile(worker).catch(() => {});
      await hydrateProviderReputation();
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

  document.querySelector("#availability-form")?.addEventListener("submit", saveProviderAvailability);

  const supplyForm = document.querySelector("#supply-request-form");
  const supplyCategoryInput = document.querySelector("#supply-category");
  const supplyCategoryLabel = document.querySelector("#supply-category-label");
  const supplyStatus = document.querySelector("#supply-status");
  const supplySubmit = document.querySelector("#supply-submit");
  const supplyLabels = {
    cleaning_products: "Productos de limpieza",
    tools: "Herramientas",
    uniform: "Uniforme",
  };

  document.querySelectorAll("[data-supply-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.supplyCategory;
      if (supplyCategoryInput) supplyCategoryInput.value = category;
      if (supplyCategoryLabel) supplyCategoryLabel.textContent = supplyLabels[category] || "Insumo";
      if (supplyForm) supplyForm.hidden = false;
      setStatus(supplyStatus, "");
      supplyForm?.querySelector('input[name="item"]')?.focus();
    });
  });

  document.querySelector("#supply-form-close")?.addEventListener("click", () => {
    if (supplyForm) supplyForm.hidden = true;
    if (supplyCategoryInput) supplyCategoryInput.value = "";
    setStatus(supplyStatus, "");
  });

  supplyForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!auth.currentUser) return;

    const category = String(supplyForm.category.value || "");
    const item = String(supplyForm.item.value || "").trim();
    const quantity = Number(supplyForm.quantity.value || 1);
    const note = String(supplyForm.note.value || "").trim();
    const photo = supplyForm.photo.files?.[0] || null;

    if (supplySubmit) supplySubmit.disabled = true;
    setStatus(supplyStatus, "Enviando aviso a Compras…", "info");

    try {
      if (document.body.dataset.providerMode !== "shinext_partner") {
        throw new Error("Las solicitudes de insumos están disponibles únicamente para Shinext Partners.");
      }

      let requestId;
      if (firebaseCapabilities.functions) {
        const result = await createSupplyRequest({ category, item, quantity, note });
        requestId = result.data.requestId;
      } else {
        const requestRef = await addDoc(collection(db, "supplyRequests"), {
          workerUid: auth.currentUser.uid,
          category,
          item,
          quantity,
          note,
          status: "reported",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        requestId = requestRef.id;
      }

      if (photo && firebaseCapabilities.storage) {
        if (photo.size > 8 * 1024 * 1024) {
          throw new Error("La foto supera el máximo de 8 MB.");
        }

        const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `supply-requests/${auth.currentUser.uid}/${requestId}/evidence.${extension}`;
        await uploadBytes(storageRef(storage, path), photo, {
          contentType: photo.type,
        });
        await updateSupplyRequest({
          requestId,
          action: "attach_photo",
          photoPath: path,
        });
      }

      supplyForm.reset();
      if (supplyCategoryInput) supplyCategoryInput.value = "";
      if (supplyForm) supplyForm.hidden = true;
      setStatus(
        supplyStatus,
        "Aviso enviado. Compras Shinext podrá darle seguimiento.",
        "success",
      );
      await loadWorkerOperations(auth.currentUser);
    } catch (error) {
      setStatus(supplyStatus, humanizeError(error), "error");
    } finally {
      if (supplySubmit) supplySubmit.disabled = false;
    }
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