// Opens a generated site at desktop and phone size, drives the main paths and
// fails on any console error. Usage: node scripts/browser-check.cjs out/demo.html
const { chromium, devices } = require("playwright");
const path = require("node:path");

(async () => {
  const file = "file://" + path.resolve(process.argv[2] || "out/demo.html");
  const browser = await chromium.launch();
  let failed = false;
  for (const [name, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["phone", devices["iPhone 13"]]]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(file);
    const check = async (label, fn) => {
      try { await fn(); } catch (e) { errors.push(`${label}: ${e.message.split("\n")[0]}`); }
    };
    await check("countdown", async () => { if ((await page.textContent("#cdNum")) === "--") throw new Error("countdown not set"); });
    await check("plan", async () => { await page.click('#nav button[data-v="plan"]'); await page.locator("#planList .card").first().waitFor(); await page.locator("#planList input[type=checkbox]").first().check(); });
    await check("cards", async () => { await page.click('#nav button[data-v="know"]'); await page.locator(".kcard").first().click(); if (!(await page.locator(".kcard.flip").count())) throw new Error("card did not flip"); });
    await check("quiz", async () => { await page.click('#nav button[data-v="quiz"]'); await page.locator(".qcard .opt").first().click(); await page.locator(".explain.show").first().waitFor(); });
    await check("case", async () => {
      const nav = page.locator('#nav button[data-v="case"]');
      if (await nav.isVisible()) { await nav.click(); await page.locator(".ccard .chead").first().click(); await page.locator(".ccard.open").first().waitFor(); }
    });
    await check("lang zh", async () => { await page.click('#langBtn span[data-l="zh"]'); if ((await page.textContent('#nav button[data-v="home"]')) !== "总览") throw new Error("not switched"); });
    await check("lang en", async () => { await page.click('#langBtn span[data-l="en"]'); });
    await check("persist", async () => { await page.reload(); await page.click('#nav button[data-v="plan"]'); if (!(await page.locator("#planList input[type=checkbox]").first().isChecked())) throw new Error("plan tick not saved"); });
    await check("no horizontal scroll", async () => {
      const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (w > 1) throw new Error(`page is ${w}px wider than the viewport`);
    });
    await page.click('#nav button[data-v="home"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `out/${name}.png`, fullPage: false });
    console.log(`${name}: ${errors.length ? "FAIL\n  " + errors.join("\n  ") : "ok"}`);
    failed ||= errors.length > 0;
    await ctx.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
