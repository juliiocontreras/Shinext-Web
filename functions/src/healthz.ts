import { onRequest } from "firebase-functions/v2/https";

export const healthz = onRequest((request, response) => {
  response.set("Cache-Control", "no-store");
  response.set("Content-Type", "application/json; charset=utf-8");
  response.status(200).json({
    ok: true,
    service: "shinext-functions",
    version: 1,
  });
});
