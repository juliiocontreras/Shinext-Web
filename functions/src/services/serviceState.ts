import { HttpsError } from "firebase-functions/v2/https";

export const SERVICE_REQUEST_ASSIGNABLE_STATES = [
  "new",
  "reviewing",
  "quoted",
  "searching_worker",
  "offered",
] as const;

export type ServiceRequestAssignableState =
  (typeof SERVICE_REQUEST_ASSIGNABLE_STATES)[number];

export const SERVICE_STATES = [
  "scheduled",
  "en_route",
  "started",
  "completed",
  "cancelled",
  "incident",
] as const;

export type ServiceState = (typeof SERVICE_STATES)[number];

export const OFFER_STATES = [
  "pending",
  "accepted",
  "rejected",
  "covered",
  "cancelled",
] as const;

export type OfferState = (typeof OFFER_STATES)[number];

export function assertAssignableRequest(request: {
  status?: unknown;
  assignedWorkerUid?: unknown;
}): void {
  if (typeof request.assignedWorkerUid === "string" && request.assignedWorkerUid) {
    throw new HttpsError(
      "already-exists",
      "Este servicio ya fue asignado a otro Trabajador Shinext.",
    );
  }

  if (
    typeof request.status !== "string" ||
    !SERVICE_REQUEST_ASSIGNABLE_STATES.includes(
      request.status as ServiceRequestAssignableState,
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "La solicitud ya no está disponible para asignación.",
    );
  }
}

export function assertPendingOffer(
  offer: { status?: unknown; workerUid?: unknown },
  workerUid: string,
): void {
  if (offer.workerUid !== workerUid) {
    throw new HttpsError(
      "permission-denied",
      "Esta oferta no pertenece a tu cuenta.",
    );
  }

  if (offer.status !== "pending") {
    throw new HttpsError(
      "failed-precondition",
      "Esta oferta ya no está pendiente.",
    );
  }
}

export function normalizeOfferDecision(value: unknown): "accept" | "reject" {
  if (value === "accept" || value === "reject") return value;

  throw new HttpsError(
    "invalid-argument",
    "La respuesta debe ser aceptar o rechazar.",
  );
}
