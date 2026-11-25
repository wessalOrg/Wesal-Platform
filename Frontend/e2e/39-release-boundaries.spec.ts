import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { setupExternalBookings } from "./helpers/external-bookings-fixture";

const root = process.cwd();
test("a clean checkout typechecks without the ignored local demo module", () => {
  const configFile = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
  const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
  const ignored = path.join(root, "src/lib/demo-auth.ts").toLowerCase();
  const options = { ...config.options, noEmit: true, incremental: false };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile, fileExists = host.fileExists;
  host.readFile = name => path.resolve(name).toLowerCase() === ignored ? undefined : readFile(name);
  host.fileExists = name => path.resolve(name).toLowerCase() !== ignored && fileExists(name);
  const program = ts.createProgram(config.fileNames.filter(name => path.resolve(name).toLowerCase() !== ignored), options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error);
  expect(errors.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual([]);
});

for (const nodeEnv of ["development", "production", "test"]) {
  for (const enabled of ["true", "false"]) {
    test(`demo mode requires local development: ${nodeEnv}, flag=${enabled}`, async () => {
      const result = await build({
        stdin: { contents: "import{isDemoModeEnabled}from'./src/lib/demo-mode';globalThis.enabled=isDemoModeEnabled()", resolveDir: root },
        bundle: true, write: false, platform: "browser",
        define: { "process.env.NODE_ENV": JSON.stringify(nodeEnv), "process.env.NEXT_PUBLIC_DEMO_MODE": JSON.stringify(enabled) },
      });
      const context: { enabled?: boolean } = {};
      vm.runInNewContext(result.outputFiles[0].text, context);
      expect(context.enabled).toBe(nodeEnv === "development" && enabled === "true");
    });
  }
}

for (const nodeEnv of ["development", "production"]) {
  for (const localFileExists of [false, true]) {
    test(`Next resolves optional demo code safely: ${nodeEnv}, local file=${localFileExists}`, () => {
      const source = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
      const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
      const requireModule = createRequire(path.join(root, "package.json"));
      const context = { exports: {} as { default?: { turbopack: { resolveAlias: Record<string, string> } } }, __dirname: root,
        process: { env: { NODE_ENV: nodeEnv, NEXT_PUBLIC_DEMO_MODE: "true" } },
        require: (id: string) => id === "node:fs" ? { existsSync: () => localFileExists } : requireModule(id) };
      vm.runInNewContext(code, context);
      expect(Boolean(context.exports.default?.turbopack.resolveAlias["@/lib/demo-login"]))
        .toBe(nodeEnv === "development" && localFileExists);
    });
  }
}

test("production adapter contains no fabricated accounts or demo session writes", async () => {
  const result = await build({
    stdin: { contents: "import{applyDemoSession}from'./src/lib/demo-login';globalThis.result=applyDemoSession('Admin')", resolveDir: root },
    bundle: true, write: false, platform: "browser",
  });
  const context: { result?: unknown } = {};
  vm.runInNewContext(result.outputFiles[0].text, context);
  expect(context.result).toBeNull();
  expect(result.outputFiles[0].text).not.toMatch(/stub-admin|demo-admin|setStoredAuth|wesal_profile_mock/);
});

test("API requests retain the initiating account's token during a same-turn login switch", async ({ page }) => {
  const result = await build({
    stdin: { contents: `import api from './src/lib/api';import{setAccessToken}from'./src/lib/auth-token';
      import{setStoredAuth}from'./src/lib/auth-storage';
      const login=id=>{setAccessToken(id+'-token');setStoredAuth({token:id+'-token',user:{id}})};
      window.sent=[];api.defaults.adapter=async config=>{window.sent.push(config.headers.Authorization);
        return{config,data:{},status:200,statusText:'OK',headers:{}}};
      login('A');const pending=api.put('/profile',{fullName:'A edited'});login('B');
      pending.then(()=>window.finished=true);`, resolveDir: root },
    bundle: true, write: false, platform: "browser",
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"',
      "process.env.VERCEL_ENV": "undefined" },
  });
  await page.route("**/token-binding", route => route.fulfill({ contentType: "text/html", body: "<html></html>" }));
  await page.goto("http://localhost:3000/token-binding");
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await expect.poll(() => page.evaluate("window.finished")).toBe(true);
  expect(await page.evaluate("window.sent")).toEqual(["Bearer A-token"]);
});

test("production login never displays local demo buttons", async ({ page }) => {
  test.skip(process.env.WESAL_TEST_PRODUCTION !== "true", "Requires the production server");
  await page.route("**/api/v1/**", route => route.fulfill({ contentType: "application/json", body: '{"isAuthenticated":false}' }));
  await page.goto("/login");
  await expect(page.locator("input[type='password']")).toBeVisible();
  await expect(page.locator('[data-testid^="login-demo-"]')).toHaveCount(0);
});

test("local development retains the optional ignored demo login", async ({ page }) => {
  const baseURL = process.env.WESAL_PWA_DEVELOPMENT_URL;
  test.skip(!baseURL || !fs.existsSync(path.join(root, "src/lib/demo-auth.ts")), "Requires the optional local demo module and development server");
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/v1/")) {
      const authenticated = Boolean(route.request().headers().authorization);
      return route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({ isAuthenticated: authenticated, role: authenticated ? "Admin" : null, userName: "Local demo" }) });
    }
    if (url.pathname.startsWith("/hubs/")) return route.fulfill({ status: 404, body: "" });
    return url.origin === baseURL ? route.continue() : route.abort();
  });
  await page.goto(baseURL + "/login");
  await page.getByTestId("login-demo-admin").click();
  await expect.poll(() => page.evaluate(() => {
    const raw = sessionStorage.getItem("wesal_auth") ?? localStorage.getItem("wesal_auth");
    return raw ? JSON.parse(raw).user.role : null;
  })).toBe("Admin");
  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
});

for (const timezoneId of ["UTC", "Asia/Hebron"]) {
  test.describe(`booking date uses browser timezone: ${timezoneId}`, () => {
    test.use({ timezoneId });
    test("UTC midnight boundary keeps the seeded booking on the selected calendar day", async ({ page }) => {
      await page.clock.setFixedTime(new Date("2030-06-15T23:30:00Z"));
      const state = await setupExternalBookings(page, { existing: true });
      expect(state.date).toBe(timezoneId === "UTC" ? "2030-06-15" : "2030-06-16");
      await expect(page.getByTestId("owner-calendar-booked")).toContainText("External Customer");
    });
  });
}
