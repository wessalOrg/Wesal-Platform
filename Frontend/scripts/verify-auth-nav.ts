/**
 * Lightweight verification for post-login navigation + auth redirect helpers.
 * Run: npx tsx scripts/verify-auth-nav.ts
 */
import assert from "node:assert/strict";
import { navigateAfterAuth } from "../src/lib/auth-nav";
import {
  resolveAuthRedirect,
  sanitizeInternalPath,
} from "../src/lib/auth-storage";

type Call = { method: "push" | "replace"; href: string };

type WindowStub = {
  location: {
    pathname: string;
    assign: (path: string) => void;
    href: string;
  };
  setTimeout: (handler: () => void, ms?: number) => number;
};

function setWindow(stub: WindowStub) {
  (globalThis as unknown as { window: WindowStub }).window = stub;
}

function createRouterMock() {
  const calls: Call[] = [];
  return {
    calls,
    router: {
      push(href: string) {
        calls.push({ method: "push", href });
      },
      replace(href: string) {
        calls.push({ method: "replace", href });
      },
    },
  };
}

function testSanitize() {
  assert.equal(sanitizeInternalPath("/"), "/");
  assert.equal(sanitizeInternalPath("/halls/1"), "/halls/1");
  assert.equal(sanitizeInternalPath("https://evil.com"), undefined);
  assert.equal(sanitizeInternalPath("//evil.com"), undefined);
  assert.equal(sanitizeInternalPath("halls"), undefined);
  console.log("ok  sanitizeInternalPath");
}

function testResolveRedirect() {
  assert.equal(resolveAuthRedirect(undefined, undefined), "/");
  assert.equal(resolveAuthRedirect("/profile", undefined), "/profile");
  assert.equal(resolveAuthRedirect("/messages", undefined), "/messages");
  assert.equal(resolveAuthRedirect("https://evil.com", undefined), "/");
  console.log("ok  resolveAuthRedirect");
}

function testNavigateHappyPath() {
  const assigns: string[] = [];
  const { router, calls } = createRouterMock();

  setWindow({
    location: {
      get pathname() {
        return calls.length > 0 ? "/" : "/login";
      },
      assign(path: string) {
        assigns.push(path);
      },
      href: "/",
    },
    setTimeout(handler: () => void) {
      handler();
      return 0;
    },
  });

  navigateAfterAuth(router, "/");
  assert.equal(calls[0]?.method, "push");
  assert.equal(calls[0]?.href, "/");
  assert.equal(assigns.length, 0);
  console.log("ok  navigateAfterAuth happy path (no hard nav)");
}

function testNavigateRetryPrefersTarget() {
  const assigns: string[] = [];
  const { router, calls } = createRouterMock();

  setWindow({
    location: {
      pathname: "/login",
      assign(path: string) {
        assigns.push(path);
      },
      href: "/login",
    },
    setTimeout(handler: () => void) {
      handler();
      return 0;
    },
  });

  navigateAfterAuth(router, "/halls/abc");

  assert.equal(calls[0]?.href, "/halls/abc");
  assert.ok(calls.some((c) => c.method === "replace" && c.href === "/halls/abc"));
  assert.deepEqual(assigns, ["/halls/abc"]);
  assert.ok(!assigns.includes("/"), "must not force homepage when target is halls");
  console.log("ok  navigateAfterAuth stuck retry prefers target (not /)");
}

function testNavigateInvalidFallsBackHome() {
  const { router, calls } = createRouterMock();

  setWindow({
    location: {
      pathname: "/login",
      assign() {},
      href: "/login",
    },
    setTimeout(handler: () => void) {
      handler();
      return 0;
    },
  });

  navigateAfterAuth(router, "https://evil.example");
  assert.equal(calls[0]?.href, "/");
  console.log("ok  navigateAfterAuth invalid destination → /");
}

function testPushThrowsThenHardTarget() {
  const assigns: string[] = [];

  setWindow({
    location: {
      pathname: "/login",
      assign(path: string) {
        assigns.push(path);
      },
      href: "/login",
    },
    setTimeout() {
      return 0;
    },
  });

  const router = {
    push() {
      throw new Error("push failed");
    },
    replace() {
      throw new Error("replace failed");
    },
  };

  navigateAfterAuth(router, "/profile");
  assert.deepEqual(assigns, ["/profile"]);
  console.log("ok  navigateAfterAuth soft fail → hard target");
}

testSanitize();
testResolveRedirect();
testNavigateHappyPath();
testNavigateRetryPrefersTarget();
testNavigateInvalidFallsBackHome();
testPushThrowsThenHardTarget();

console.log("\nAll auth-nav verifications passed.");
