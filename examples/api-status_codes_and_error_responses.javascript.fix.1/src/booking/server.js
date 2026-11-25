import http from "node:http";
import { toHttpError } from "./mapError.js";

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw === "" ? {} : JSON.parse(raw);
}

function send(res, status, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

export function createServer(service) {
  return http.createServer(async (req, res) => {
    try {
      const match = /^\/events\/([^/]+)\/holds$/.exec(req.url);
      if (!match || req.method !== "POST") {
        return send(res, 404, { error: { code: "no_route", message: "no such route" } });
      }
      const body = await readJson(req);
      const hold = service.holdSeat(match[1], body.seat, body.customer);
      return send(res, 201, hold);
    } catch (err) {
      const { status, body } = toHttpError(err);
      return send(res, status, body);
    }
  });
}
