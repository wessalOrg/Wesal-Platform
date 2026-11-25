import { createServer, request as httpRequest } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

/** Retain the controller before deployment; update events can fire during getRegistration(). */
export async function deployPwaUpdate(page: Page, nextDeployment: () => void) {
  const previous = await page.evaluateHandle(() => {
    if (!navigator.serviceWorker.controller) throw new Error("Expected an active production worker");
    return navigator.serviceWorker.controller;
  });
  try {
    nextDeployment();
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error("Expected a production worker registration");
      await registration.update();
    });
    // Inspect current state rather than waiting for an event which may already have fired.
    await page.waitForFunction(previous => {
      const current = navigator.serviceWorker.controller;
      return current !== null && current !== previous;
    }, previous, { polling: 50 });
  } finally {
    await previous.dispose();
  }
}

/** Local production test proxy: change worker bytes without editing public/sw.js. */
export async function startPwaUpdateProxy(upstream: string, origin: string) {
  const target = new URL(upstream), address = new URL(origin);
  for (const url of [target, address]) {
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw new Error("PWA production tests require local HTTP servers");
    }
  }
  let revision = 1;
  const worker = readFileSync(path.resolve("public/sw.js"), "utf8");
  const server = createServer((incoming, outgoing) => {
    if (incoming.url?.split("?")[0] === "/sw.js") {
      outgoing.writeHead(200, { "Content-Type": "application/javascript", "Cache-Control": "no-store", "Service-Worker-Allowed": "/" });
      outgoing.end(`${worker}\n// Local test deployment ${revision}\n`);
      return;
    }
    // The tests must supply every API response; this server only proxies Next.js.
    if (incoming.url?.startsWith("/api/") || incoming.url?.startsWith("/hubs/")) {
      outgoing.writeHead(503); outgoing.end("API requests must be mocked"); return;
    }
    const forward = httpRequest(new URL(incoming.url ?? "/", target), {
      method: incoming.method, headers: { ...incoming.headers, host: target.host },
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    });
    forward.on("error", () => { outgoing.writeHead(502); outgoing.end("Local production frontend unavailable"); });
    incoming.pipe(forward);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(address.port), address.hostname, resolve);
  });
  return {
    nextDeployment: () => { revision += 1; },
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections(); server.close((error) => error ? reject(error) : resolve());
    }),
  };
}
