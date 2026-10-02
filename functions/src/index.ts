import { onCall } from "firebase-functions/v2/https";

export { approveWorker } from "./recruitment/approveWorker.js";
export { updateApplication } from "./recruitment/updateApplication.js";
export { createOffer } from "./services/createOffer.js";
export { respondToOffer } from "./services/respondToOffer.js";
export { addServiceNote } from "./services/addServiceNote.js";
export { reportIncident } from "./services/reportIncident.js";
export { closeService } from "./finance/closeService.js";
export { markWorkerPayment } from "./finance/markWorkerPayment.js";
export { createSupplyRequest } from "./supplies/createSupplyRequest.js";
export { updateSupplyRequest } from "./supplies/updateSupplyRequest.js";

export const foundationHealth = onCall(() => ({
  ok: true,
  service: "shinext-functions",
  version: 1,
}));
