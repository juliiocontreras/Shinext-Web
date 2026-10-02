import { onCall } from "firebase-functions/v2/https";

export const foundationHealth = onCall(() => ({
  ok: true,
  service: "shinext-functions",
  version: 1,
}));
