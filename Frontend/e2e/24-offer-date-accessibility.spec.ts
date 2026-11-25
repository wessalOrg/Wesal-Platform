import { expect, test, type Locator, type Page } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import ar from "../src/i18n/messages/ar";
import en from "../src/i18n/messages/en";
import { getOfferDateFieldErrors, getOfferFieldErrors } from "../src/lib/offer-form-validation";

let bundle: string;
test.beforeAll(async () => {
  const mocks: Record<string, string> = {
    "@/i18n": `const catalog=new URLSearchParams(location.search).get('lang')==='ar'?${JSON.stringify(ar)}:${JSON.stringify(en)};
      const translate=(key,vars={})=>Object.entries(vars).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',String(v)),catalog[key]??key);export const useT=()=>translate;`,
    "@/components/layout/LanguageProvider": `export const useUiLang=()=>new URLSearchParams(location.search).get('lang')||'en';`,
  };
  const output = await build({
    stdin: { contents: `import React,{StrictMode,useId,useState} from 'react';import {createRoot} from 'react-dom/client';
      import Main from './src/components/offers/ProfessionalOfferForm';import Inline from './src/components/professionals/ProfessionalOfferForm';
      import DateField from './src/components/ui/WesalDateTimeField';import {useOfferValidationErrors} from './src/components/offers/OfferValidationErrors';
      import {getOfferFieldErrors} from './src/lib/offer-form-validation';import {useT} from './src/i18n';
      function Probe(){const t=useT(),id=useId();const [startsAt,setStart]=useState('bad-start'),[endsAt,setEnd]=useState('bad-end');
        const {setErrors,revalidateDates,fieldProps,errorFor}=useOfferValidationErrors();return <section data-testid="probe">
        <label htmlFor={id+'-start'}>{t('offers.form.startsAt')}</label><DateField id={id+'-start'} required value={startsAt} {...fieldProps('startsAt')}
          onChange={value=>{setStart(value);revalidateDates({startsAt:value,endsAt})}}/>{errorFor('startsAt')}
        <label htmlFor={id+'-end'}>{t('offers.form.endsAt')}</label><DateField id={id+'-end'} required value={endsAt} {...fieldProps('endsAt')}
          onChange={value=>{setEnd(value);revalidateDates({startsAt,endsAt:value})}}/>{errorFor('endsAt')}
        <button id="validate" onClick={()=>setErrors(getOfferFieldErrors({startsAt,endsAt,oldPrice:'200',offerPrice:'100'}))}>Validate</button></section>}
      function Harness(){const [saved,setSaved]=useState(0),auxId=useId();return new URLSearchParams(location.search).has('probe')?<Probe/>:<>
        {[0,1].map(n=><section key={'m'+n} data-testid={'main-'+n}><Main mode="create" onCancel={()=>{}} onSubmit={()=>setSaved(x=>x+1)}/></section>)}
        {[0,1].map(n=><section key={'i'+n} data-testid={'inline-'+n}><Inline onClose={()=>{}} onSaved={()=>setSaved(x=>x+1)}/></section>)}
        <DateField value="" onChange={()=>{}} aria-label="Auxiliary date one"/>
        <span id={auxId}>Auxiliary date two</span><DateField value="" onChange={()=>{}} aria-labelledby={auxId}/>
        <output id="saved">{saved}</output></>}
      createRoot(document.getElementById('root')).render(<StrictMode><Harness/></StrictMode>);`,
      loader: "tsx", resolveDir: process.cwd() },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    tsconfig: path.resolve("tsconfig.json"), loader: { ".css": "empty" },
    define: { "process.env.NODE_ENV": '"development"', "process.env.NEXT_PUBLIC_API_BASE_URL": '"http://localhost:3000/api/v1"', "process.env.VERCEL_ENV": "undefined" },
    plugins: [{ name: "translations", setup(builder) {
      builder.onResolve({ filter: /.*/ }, ({ path: name }) => name in mocks ? { path: name, namespace: "stub" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: name }) => ({ contents: mocks[name], loader: "tsx", resolveDir: process.cwd() }));
    } }],
  });
  bundle = output.outputFiles[0].text;
});

type Mode = "main" | "inline";
type Language = "ar" | "en";
async function mount(page: Page, lang: Language, probe = false) {
  await page.clock.setFixedTime(new Date("2030-01-10T10:00:00Z"));
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/**", (route) => {
    writes.push(route.request().postData() ?? "");
    return route.fulfill({ status: 201, contentType: "application/json", body: '{"id":"saved"}' });
  });
  await page.route("**/date-accessibility**", (route) => route.fulfill({ contentType: "text/html",
    body: `<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><body><div id="root"></div></body></html>` }));
  await page.goto(`http://localhost:3000/date-accessibility?lang=${lang}${probe ? "&probe=1" : ""}`);
  await page.addScriptTag({ content: bundle });
  return { errors, writes, catalog: lang === "ar" ? ar : en };
}
function fields(form: Locator, mode: Mode, lang: Language) {
  const catalog = lang === "ar" ? ar : en;
  return {
    start: form.getByRole("combobox", { name: catalog[mode === "main" ? "offers.form.startsAt" : "professionals.offers.startsLabel"], exact: true }),
    end: form.getByRole("combobox", { name: catalog[mode === "main" ? "offers.form.endsAt" : "professionals.offers.endsLabel"], exact: true }),
    submit: mode === "main" ? form.locator('button[type="submit"]') : form.getByTestId("professional-offer-submit"),
  };
}
async function selectDay(page: Page, trigger: Locator, day: number, lang: Language) {
  await trigger.click();
  const panel = page.locator(".wesal-datetime-panel");
  await panel.locator(".wesal-datetime-day").filter({ hasText: new RegExp(`^${day}$`) }).click();
  await panel.getByRole("button", { name: (lang === "ar" ? ar : en)["common.ok"], exact: true }).click();
  await expect(trigger).toBeFocused();
}
async function assertError(field: Locator, message: Locator, text: string) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(message).toHaveText(text);
  const errorId = await message.getAttribute("id");
  expect((await field.getAttribute("aria-describedby"))?.split(/\s+/)).toContain(errorId);
  await expect(field).toHaveAccessibleDescription(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("date feedback identifies each field without changing A05 acceptance rules", () => {
  const now = new Date("2030-01-10T10:00:00Z"), valid = { startsAt: "2030-01-15T10:00", endsAt: "2030-01-20T10:00" };
  expect(getOfferDateFieldErrors(valid, now)).toEqual({});
  expect(getOfferDateFieldErrors({ startsAt: "", endsAt: "" }, now)).toEqual({ startsAt: "offers.validation.startRequired", endsAt: "offers.validation.endRequired" });
  expect(getOfferDateFieldErrors({ ...valid, startsAt: "2030-02-30T10:00" }, now)).toEqual({ startsAt: "offers.validation.startInvalid" });
  expect(getOfferDateFieldErrors({ ...valid, endsAt: "2030-01-20T25:00" }, now)).toEqual({ endsAt: "offers.validation.endInvalid" });
  for (const endsAt of [valid.startsAt, "2030-01-14T10:00"]) expect(getOfferDateFieldErrors({ ...valid, endsAt }, now)).toEqual({ endsAt: "offers.validation.endAfterStart" });
  expect(getOfferDateFieldErrors({ startsAt: "2030-01-01T10:00", endsAt: "2030-01-05T10:00" }, now)).toEqual({ endsAt: "offers.validation.endNotFuture" });
  expect(getOfferDateFieldErrors({ ...valid, startsAt: "2030-01-01T10:00" }, now)).toEqual({});
  expect(getOfferFieldErrors({ ...valid, oldPrice: "200", offerPrice: "100" }, now)).toEqual({});
});

for (const lang of ["ar", "en"] as const) for (const mode of ["main", "inline"] as const) {
  test(`${mode} ${lang}: date controls have labels, required descriptions and globally unique IDs`, async ({ page }) => {
    const { catalog, errors } = await mount(page, lang);
    const form = page.getByTestId(`${mode}-0`), { start, end } = fields(form, mode, lang);
    for (const control of [start, end]) {
      await expect(control).toBeVisible();
      await expect(control).toHaveAttribute("aria-haspopup", "dialog");
      await expect(control).toHaveAttribute("aria-required", "true");
      await expect(control).toHaveAccessibleDescription(new RegExp(catalog["offers.validation.dateRequiredHint"].replace(/\./g, "\\.")));
      expect(await control.evaluate((button) => {
        const labels = (button as HTMLButtonElement).labels;
        return labels?.length === 1 && labels[0].control === button;
      })).toBe(true);
    }
    await expect(page.locator(".wesal-datetime-trigger")).toHaveCount(10);
    const ids = await page.locator(".wesal-datetime-trigger").evaluateAll((buttons) => buttons.map((button) => button.id));
    expect(ids.every(Boolean)).toBe(true); expect(new Set(ids).size).toBe(ids.length);
    await expect(page.getByRole("combobox", { name: "Auxiliary date two", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`${mode} ${lang}: date errors remain associated and update independently after correction`, async ({ page }) => {
    const { catalog, errors } = await mount(page, lang);
    const form = page.getByTestId(`${mode}-0`), { start, end, submit } = fields(form, mode, lang);
    await form.getByTestId("offer-field-oldPrice").fill("200");
    await form.getByTestId("offer-field-offerPrice").fill("100");
    await form.getByTestId("offer-field-content").fill("Valid offer");
    await submit.click();
    await assertError(start, form.getByTestId("offer-error-startsAt"), catalog["offers.validation.startRequired"]);
    await assertError(end, form.getByTestId("offer-error-endsAt"), catalog["offers.validation.endRequired"]);
    await selectDay(page, start, 15, lang);
    await expect(start).toHaveAccessibleDescription(/15 \/ 01 \/ 2030/);
    await expect(start).toHaveAttribute("aria-invalid", "false");
    await expect(form.getByTestId("offer-error-startsAt")).toHaveCount(0);
    await assertError(end, form.getByTestId("offer-error-endsAt"), catalog["offers.validation.endRequired"]);
    await selectDay(page, end, 14, lang);
    await assertError(end, form.getByTestId("offer-error-endsAt"), catalog["offers.validation.endAfterStart"]);
    const oldErrorId = await form.getByTestId("offer-error-endsAt").getAttribute("id");
    await selectDay(page, end, 20, lang);
    await expect(end).toHaveAttribute("aria-invalid", "false");
    await expect(form.getByTestId("offer-error-endsAt")).toHaveCount(0);
    expect((await end.getAttribute("aria-describedby"))?.split(/\s+/)).not.toContain(oldErrorId);
    await submit.click();
    await expect(page.locator("#saved")).toHaveText("1");
    expect(errors).toEqual([]);
  });

  test(`${mode} ${lang}: keyboard opening, tab navigation, Escape and clearing preserve focus`, async ({ page }) => {
    const { catalog } = await mount(page, lang);
    const { start, end } = fields(page.getByTestId(`${mode}-0`), mode, lang);
    await start.focus(); await page.keyboard.press("Enter");
    const panel = page.locator(".wesal-datetime-panel");
    await expect(panel.locator(".wesal-datetime-day").first()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(panel.locator(".wesal-datetime-day").nth(1)).toBeFocused();
    await page.keyboard.press("Enter"); await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0); await expect(start).toBeFocused();
    await page.keyboard.press("Tab"); await expect(end).toBeFocused();
    await page.keyboard.press("Space");
    await expect(panel).toBeVisible();
    await panel.locator(".wesal-datetime-day").last().focus();
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("button", { name: catalog["home.consult.dateClear"], exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(end).toBeFocused(); await expect(end).toHaveAttribute("aria-expanded", "false");
    await page.keyboard.press("ArrowDown");
    await expect(panel.locator(".wesal-datetime-day").first()).toBeFocused();
    await page.keyboard.press("Escape"); await expect(end).toBeFocused();
  });
}

for (const mode of ["main", "inline"] as const) test(`${mode}: correcting the start revalidates the end while preserving unrelated errors`, async ({ page }) => {
  await mount(page, "en");
  const form = page.getByTestId(`${mode}-0`), { start, end, submit } = fields(form, mode, "en");
  await form.getByTestId("offer-field-oldPrice").fill("0");
  await form.getByTestId("offer-field-offerPrice").fill("100");
  await form.getByTestId("offer-field-content").fill("Valid offer");
  await submit.click();
  await selectDay(page, start, 15, "en"); await selectDay(page, end, 14, "en");
  await assertError(end, form.getByTestId("offer-error-endsAt"), en["offers.validation.endAfterStart"]);
  await selectDay(page, start, 13, "en");
  await expect(start).toHaveAttribute("aria-invalid", "false");
  await expect(end).toHaveAttribute("aria-invalid", "false");
  await expect(form.getByTestId("offer-error-endsAt")).toHaveCount(0);
  await expect(form.getByTestId("offer-field-oldPrice")).toHaveAttribute("aria-invalid", "true");
  await expect(form.getByTestId("offer-error-oldPrice")).toBeVisible();
  await selectDay(page, start, 15, "en"); await submit.click();
  await assertError(end, form.getByTestId("offer-error-endsAt"), en["offers.validation.endAfterStart"]);
  await form.getByTestId("offer-field-oldPrice").fill("200");
  await assertError(end, form.getByTestId("offer-error-endsAt"), en["offers.validation.endAfterStart"]);
  await selectDay(page, start, 13, "en");
  await expect(form.getByTestId("offer-error-endsAt")).toHaveCount(0);
});

for (const lang of ["ar", "en"] as const) {
  test(`${lang}: invalid start and end values have distinct translated feedback`, async ({ page }) => {
    const { catalog } = await mount(page, lang, true);
    const probe = page.getByTestId("probe");
    await page.locator("#validate").click();
    const start = probe.getByRole("combobox", { name: catalog["offers.form.startsAt"], exact: true });
    const end = probe.getByRole("combobox", { name: catalog["offers.form.endsAt"], exact: true });
    await assertError(start, probe.getByTestId("offer-error-startsAt"), catalog["offers.validation.startInvalid"]);
    await assertError(end, probe.getByTestId("offer-error-endsAt"), catalog["offers.validation.endInvalid"]);
    await selectDay(page, start, 15, lang);
    await expect(start).toHaveAttribute("aria-invalid", "false");
    await assertError(end, probe.getByTestId("offer-error-endsAt"), catalog["offers.validation.endInvalid"]);
    await selectDay(page, end, 20, lang);
    await expect(probe.getByRole("alert")).toHaveCount(0);
  });
}

for (const width of [390, 768, 1366]) test(`Arabic date labels and validation remain usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await mount(page, "ar");
  const form = page.getByTestId("main-0"), { start, end, submit } = fields(form, "main", "ar");
  await submit.click();
  await assertError(start, form.getByTestId("offer-error-startsAt"), ar["offers.validation.startRequired"]);
  await assertError(end, form.getByTestId("offer-error-endsAt"), ar["offers.validation.endRequired"]);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
