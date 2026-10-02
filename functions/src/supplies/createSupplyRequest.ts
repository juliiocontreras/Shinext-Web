import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { writeAudit } from "../audit/writeAudit.js";

export const SUPPLY_CATEGORIES = [
  "cleaning_products",
  "tools",
  "uniform",
] as const;

export type SupplyCategory = (typeof SUPPLY_CATEGORIES)[number];

export function normalizeSupplyCategory(value: unknown): SupplyCategory {
  if (
    typeof value === "string" &&
    SUPPLY_CATEGORIES.includes(value as SupplyCategory)
  ) {
    return value as SupplyCategory;
  }

  throw new HttpsError(
    "invalid-argument",
    "Selecciona una categoría de insumo válida.",
  );
}

export function normalizeSupplyQuantity(value: unknown): number {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw new HttpsError(
      "invalid-argument",
      "La cantidad debe ser un número entre 1 y 99.",
    );
  }
  return quantity;
}

export function normalizeSupplyText(
  value: unknown,
  field: "item" | "note",
): string {
  const text = String(value || "").trim();
  const min = field === "item" ? 2 : 0;
  const max = field === "item" ? 120 : 500;

  if (text.length < min || text.length > max) {
    throw new HttpsError(
      "invalid-argument",
      field === "item"
        ? "Indica qué insumo necesitas."
        : "La nota es demasiado larga.",
    );
  }

  return text;
}

export const createSupplyRequest = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  }

  if (request.auth.token.role !== "worker") {
    throw new HttpsError(
      "permission-denied",
      "Solo un Trabajador Shinext puede reportar sus insumos desde este portal.",
    );
  }

  const category = normalizeSupplyCategory(request.data?.category);
  const item = normalizeSupplyText(request.data?.item, "item");
  const quantity = normalizeSupplyQuantity(request.data?.quantity);
  const note = normalizeSupplyText(request.data?.note, "note");

  const db = getFirestore();
  const workerSnapshot = await db.collection("workers").doc(request.auth.uid).get();

  if (!workerSnapshot.exists || workerSnapshot.data()?.active !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Tu perfil de trabajador no está activo.",
    );
  }

  const ref = db.collection("supplyRequests").doc();
  await ref.set({
    workerUid: request.auth.uid,
    category,
    item,
    quantity,
    note,
    status: "reported",
    photoPath: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await writeAudit({
    action: "supply_request.created",
    actorUid: request.auth.uid,
    actorRole: "worker",
    targetType: "supplyRequest",
    targetId: ref.id,
    metadata: { category, item, quantity },
  });

  return { ok: true, requestId: ref.id };
});
