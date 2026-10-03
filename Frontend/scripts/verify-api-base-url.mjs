/**
 * Executable verification for API base URL resolution and the production env gate.
 * Run: npm run verify:api-base-url   (plain Node, no extra tooling)
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DEV_API_BASE_URL,
  PROD_API_BASE_URL,
  resolveApiBaseUrlFrom,
} from "../src/lib/api-base-url.mjs";

const CANONICAL = "https://wesal-platform-p0iv.onrender.com/api/v1";
const PROD = { nodeEnv: "production", vercelEnv: "production" };

assert.equal(PROD_API_BASE_URL, CANONICAL);
assert.equal(DEV_API_BASE_URL, "http://localhost:5298/api/v1");

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

// ---- resolver (same logic api.ts uses at runtime) ----------------------------

check("A: development + env missing -> localhost dev API", () => {
  const r = resolveApiBaseUrlFrom({ nodeEnv: "development" });
  assert.deepEqual(r, { value: DEV_API_BASE_URL, source: "development" });
});

check("A2: env unset entirely (no NODE_ENV) -> localhost dev API", () => {
  assert.equal(resolveApiBaseUrlFrom({}).value, DEV_API_BASE_URL);
});

check("B: production + env missing -> canonical Render API, never localhost", () => {
  const r = resolveApiBaseUrlFrom({ ...PROD });
  assert.deepEqual(r, { value: CANONICAL, source: "canonical" });
  assert.ok(!r.value.includes("localhost"));
});

check("B2: production + blank/whitespace env -> canonical", () => {
  assert.equal(resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: "   " }).value, CANONICAL);
});

check("B3: non-Vercel production build (NODE_ENV=production) + env missing -> canonical", () => {
  assert.equal(resolveApiBaseUrlFrom({ nodeEnv: "production" }).value, CANONICAL);
});

check("C: production + valid https env -> configured value wins", () => {
  const custom = "https://api.example.com/api/v1";
  assert.deepEqual(resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: custom }), {
    value: custom,
    source: "env",
  });
});

check("C2: explicit canonical env is accepted", () => {
  assert.equal(resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: CANONICAL }).value, CANONICAL);
});

check("D: production + invalid env -> fails", () => {
  assert.throws(() => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: "not a url" }), /not a valid absolute URL/);
  assert.throws(() => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: "/api/v1" }), /not a valid absolute URL/);
  assert.throws(() => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: "ftp://api.example.com" }), /http\(s\)/);
});

check("D2: invalid env fails in development too (no silent fallback)", () => {
  assert.throws(() => resolveApiBaseUrlFrom({ nodeEnv: "development", apiBaseUrl: "nonsense" }), /not a valid absolute URL/);
});

check("E: production + http env -> fails", () => {
  assert.throws(
    () => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: "http://api.example.com/api/v1" }),
    /must use https/,
  );
});

check("E2: production deploy must not point at localhost even over https", () => {
  assert.throws(
    () => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: "https://localhost:5298/api/v1" }),
    /localhost/,
  );
});

check("E2b: production rejects every loopback / unspecified spelling", () => {
  for (const host of [
    "127.0.0.1", "127.0.0.2", "127.1", "0x7f.1", "2130706433", "[::1]", "[::]",
    "[::ffff:127.0.0.1]", "LOCALHOST", "localhost.", "api.localhost", "0.0.0.0",
  ]) {
    assert.throws(
      () => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: `https://${host}/api/v1` }),
      /localhost/,
      host,
    );
  }
});

check("E2c: malformed scheme spellings and embedded credentials are rejected", () => {
  for (const raw of ["https:/api.example.com/api/v1", "https:api.example.com/api/v1", "https:\\api.example.com"]) {
    assert.throws(() => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: raw }), /scheme:\/\/host/, raw);
  }
  assert.throws(
    () => resolveApiBaseUrlFrom({ ...PROD, apiBaseUrl: "https://user:pw@api.example.com/api/v1" }),
    /credentials/,
  );
});

check("E3: local production build (no VERCEL_ENV) may still target http localhost (CI)", () => {
  assert.equal(
    resolveApiBaseUrlFrom({ nodeEnv: "production", apiBaseUrl: DEV_API_BASE_URL }).value,
    DEV_API_BASE_URL,
  );
});

check("API origin for uploads / SignalR / media is the Render host", () => {
  assert.equal(new URL(resolveApiBaseUrlFrom({ ...PROD }).value).origin, "https://wesal-platform-p0iv.onrender.com");
  assert.equal(
    `${new URL(resolveApiBaseUrlFrom({ ...PROD }).value).origin}/hubs/conversation`,
    "https://wesal-platform-p0iv.onrender.com/hubs/conversation",
  );
});

// ---- prebuild gate (scripts/verify-production-env.mjs), end to end ------------

const gate = fileURLToPath(new URL("./verify-production-env.mjs", import.meta.url));

function runGate(env) {
  const base = { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "" };
  const r = spawnSync(process.execPath, [gate], { env: { ...base, ...env }, encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

check("gate: production + env missing -> passes and announces canonical API", () => {
  const r = runGate({ VERCEL_ENV: "production" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /Using canonical production API: https:\/\/wesal-platform-p0iv\.onrender\.com\/api\/v1/);
});

check("gate: production + valid https env -> passes", () => {
  const r = runGate({ VERCEL_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/api/v1" });
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /canonical/);
});

check("gate: production + invalid env -> fails", () => {
  const r = runGate({ VERCEL_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "garbage" });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /not a valid absolute URL/);
});

check("gate: production + http env -> fails", () => {
  const r = runGate({ VERCEL_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "http://api.example.com/api/v1" });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /must use https/);
});

check("F: production + NEXT_PUBLIC_DEMO_MODE=true -> fails", () => {
  const r = runGate({ VERCEL_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "true" });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /NEXT_PUBLIC_DEMO_MODE/);
});

check("F2: production + demo mode fails even with a valid API env", () => {
  const r = runGate({
    VERCEL_ENV: "production",
    NEXT_PUBLIC_API_BASE_URL: CANONICAL,
    NEXT_PUBLIC_DEMO_MODE: "true",
  });
  assert.equal(r.code, 1, r.out);
});

check("gate: non-production (preview / CI) only warns", () => {
  const r = runGate({ VERCEL_ENV: "preview", NEXT_PUBLIC_DEMO_MODE: "true" });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /DEMO_MODE=true/);
});

check("gate: invalid explicit URL fails outside production too (preview)", () => {
  const r = runGate({ VERCEL_ENV: "preview", NEXT_PUBLIC_API_BASE_URL: "garbage" });
  assert.equal(r.code, 1, r.out);
});

check("gate: production deploy with NODE_ENV=development would bundle localhost -> fails", () => {
  const r = runGate({ VERCEL_ENV: "production", NODE_ENV: "development" });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /would bundle the localhost API/);
  // ...unless an explicit https URL is supplied.
  const ok = runGate({ VERCEL_ENV: "production", NODE_ENV: "development", NEXT_PUBLIC_API_BASE_URL: CANONICAL });
  assert.equal(ok.code, 0, ok.out);
});

check("gate: CI-style local production build with http localhost env passes", () => {
  const r = runGate({ NEXT_PUBLIC_API_BASE_URL: DEV_API_BASE_URL });
  assert.equal(r.code, 0, r.out);
});

console.log(`\n${passed} checks passed`);
