import { HttpsError } from "firebase-functions/v2/https";

export type PaymentStatus = "pending" | "paid";

export function normalizeWorkerEarning(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000) {
    throw new HttpsError(
      "invalid-argument",
      "La ganancia del trabajador no es válida.",
    );
  }
  return Math.round(amount * 100) / 100;
}

export function assertClosableService(service: {
  status?: unknown;
  assignedWorkerUid?: unknown;
  workerEarning?: unknown;
}): { workerUid: string; workerEarning: number } {
  if (service.status !== "completed") {
    throw new HttpsError(
      "failed-precondition",
      "El servicio debe estar completado antes de generar la ganancia.",
    );
  }

  const workerUid = String(service.assignedWorkerUid || "").trim();
  if (!workerUid) {
    throw new HttpsError(
      "failed-precondition",
      "El servicio no tiene un trabajador asignado.",
    );
  }

  return {
    workerUid,
    workerEarning: normalizeWorkerEarning(service.workerEarning),
  };
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  if (value === "pending" || value === "paid") return value;
  throw new HttpsError(
    "invalid-argument",
    "El estado de pago no es válido.",
  );
}
