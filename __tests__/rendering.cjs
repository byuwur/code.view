/*
 * File: __tests__/rendering.cjs
 * Desc: Bounded, offline checks for the public CODE renderer contract.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { chromium, firefox, webkit } = require("playwright");
const engine = process.env.BROWSER_ENGINE || "chromium";
assert.ok(["chromium", "firefox", "webkit"].includes(engine), "Unsupported BROWSER_ENGINE");

test("CODE library", { timeout: 30000 }, async (t) => {
  const browser = await { chromium, firefox, webkit }[engine].launch({
    timeout: 10000,
    ...(engine === "chromium" ? { channel: process.env.BROWSER_CHANNEL, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {})
  });
  t.after(() => browser.close());
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Load authored files directly; CDN availability is not part of this contract.
  await page.route("**/*", (route) => route.abort());
  await page.setContent('<!doctype html><meta charset="UTF-8"><div id="viewer"></div>');
  await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
  await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
  await page.evaluate(() => {
    window.root = document.getElementById("viewer");
  });

  await t.test("renders the complete source and copies it unchanged", async () => {
    const source = "const value = 7;\nconsole.log(value);";
    assert.equal(
      await page.evaluate(async (source) => {
        window.copied = null;
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (text) => {
              window.copied = text;
            }
          }
        });
        return byCODEviewer(root, source, { language: "javascript", animations: false }).ready;
      }, source),
      true
    );
    assert.equal((await page.locator(".byCODEtext").allTextContents()).join("\n"), source);
    await page.locator(".byVIEWcopy").click();
    assert.equal(await page.evaluate(() => window.copied), source);
  });

  await t.test("source markup stays inert", async () => {
    const source = '<img src=x onerror="window.injected=1">';
    await page.evaluate((source) => byCODEviewer(root, source, { language: "html" }).ready, source);
    assert.equal(await page.locator("#viewer img").count(), 0);
    assert.equal(await page.locator(".byCODEtext").textContent(), source);
    assert.equal(await page.evaluate(() => window.injected), undefined);
  });

  await t.test("replacement and disposal respect the current instance", async () => {
    const result = await page.evaluate(async () => {
      const old = byCODEviewer(root, "old");
      await old.ready;
      const current = byCODEviewer(root, "current");
      const ready = await current.ready;
      old.destroy();
      const preserved = root.textContent.includes("current");
      current.destroy();
      return { ready, preserved, empty: root.childNodes.length === 0 };
    });
    assert.deepEqual(result, { ready: true, preserved: true, empty: true });
  });

  assert.deepEqual(errors, [], "No uncaught browser errors");
});
