import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp();
}

export interface AuditEvent {
  action: string;
  actorUid: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(event: AuditEvent): Promise<void> {
  const db = getFirestore();

  await db.collection("auditLog").add({
    ...event,
    createdAt: FieldValue.serverTimestamp(),
  });
}
