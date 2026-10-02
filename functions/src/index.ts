import { onCall } from "firebase-functions/v2/https";

export { approveWorker } from "./recruitment/approveWorker.js";
export { updateApplication } from "./recruitment/updateApplication.js";

export const foundationHealth = onCall(() => ({
  ok: true,
  service: "shinext-functions",
  version: 1,
}));
