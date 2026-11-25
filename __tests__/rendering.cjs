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
  // ===== BROWSER FIXTURE =====
  await page.route("https://viewer.test/", (route) => route.fulfill({
    contentType: "text/html",
    body: /* HTML */ `<!doctype html><meta charset="UTF-8" /><div id="viewer"></div>`
  }));
  await page.goto("https://viewer.test/");
  await page.addStyleTag({ path: path.join(__dirname, "../code.css") });
  await page.addScriptTag({ path: path.join(__dirname, "../code.js") });
  await page.evaluate(() => {
    window.root = document.getElementById("viewer");
  });

  // ===== RENDERING BEHAVIOR =====
  await t.test("theme toggles preserve the host's attribute and class conventions", async () => {
    const result = await page.evaluate(async () => {
      const host = document.body.appendChild(document.createElement("div"));
      host.dataset.theme = "light";
      const viewer = byCODEviewer(host, "example");
      await viewer.ready;
      const toggle = host.querySelector(".byVIEWthemeToggle");
      const mode = () => [host.dataset.theme, host.classList.contains("light"), host.classList.contains("dark")];
      toggle.click();
      const attributeOnly = mode();
      viewer.setOptions({ theme: "light" });
      toggle.click();
      const combined = mode();
      viewer.setOptions({ palette: "github" });
      toggle.click();
      const named = mode();
      viewer.destroy();
      host.remove();
      return { attributeOnly, combined, named };
    });
    assert.deepEqual(result, { attributeOnly: ["dark", false, false], combined: ["dark", false, true], named: ["github", true, false] });
  });

  await t.test("controls enabled after mounting use the current settings", async () => {
    const result = await page.evaluate(async () => {
      const viewer = byCODEviewer(root, "example", { toolbar: false });
      await viewer.ready;
      viewer.setOptions({ theme: "dark", fontSize: 3, copyButton: false });
      const hidden = !root.querySelector(".byVIEWtoolbar");
      viewer.setOptions({ toolbar: true });
      const toggle = root.querySelector(".byVIEWthemeToggle");
      const atMaximum = root.querySelector('[aria-label="Increase text size"]').disabled;
      const copyHidden = !root.querySelector(".byVIEWcopy");
      toggle.focus();
      viewer.setOptions({ toolbar: true, copyButton: false });
      const focusPreserved = document.activeElement === toggle;
      viewer.setOptions({ copyButton: true });
      return [hidden, toggle.title, atMaximum, copyHidden, focusPreserved, Boolean(root.querySelector(".byVIEWcopy"))];
    });
    assert.deepEqual(result, [true, "Switch to light theme", true, true, true, true]);
  });

  await t.test("partial updates preserve disabled flags and undefined restores their defaults", async () => {
    const states = await page.evaluate(async () => {
      const viewer = byCODEviewer(root, "example");
      await viewer.ready;
      const readFlags = () => [Boolean(root.querySelector(".byVIEWtoolbar")), root.classList.contains("byVIEWmotion"), !root.classList.contains("byVIEWplain"), !root.querySelector(".byVIEWstatus").hidden];
      const initial = readFlags();
      viewer.setOptions({ toolbar: false, animations: false, displayContainer: false, statusBar: false });
      viewer.setOptions({ controlsSize: "small" });
      const disabled = readFlags();
      viewer.setOptions({ toolbar: undefined, animations: undefined, displayContainer: undefined, statusBar: undefined });
      return [initial, disabled, readFlags()];
    });
    assert.deepEqual(states, [
      [true, true, true, true],
      [false, false, false, false],
      [true, true, true, true]
    ]);
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
    const source = /* HTML */ `<img src="x" onerror="window.injected=1" />`;
    await page.evaluate((source) => byCODEviewer(root, source, { language: "html" }).ready, source);
    assert.equal(await page.locator("#viewer img").count(), 0);
    assert.equal(await page.locator(".byCODEtext").textContent(), source);
    assert.equal(await page.evaluate(() => window.injected), undefined);
  });

  await t.test("loads a relative URL once, preserves the file text, and reuses it on redraw", async () => {
    const source = "const value = '<b>text</b>';\r\n";
    let requests = 0;
    let respond;
    const response = new Promise((resolve) => { respond = resolve; });
    await page.route("https://viewer.test/example.js", async (route) => {
      requests++;
      await response;
      await route.fulfill({ contentType: "text/plain", body: source });
    });
    await page.evaluate((url) => {
      window.fileViewer = byCODEviewer(root, `${url}`);
      window.firstReady = fileViewer.ready;
      fileViewer.setOptions({ language: "javascript" });
    }, "./example.js");
    respond();
    assert.deepEqual(await page.evaluate(async () => [await firstReady, await fileViewer.ready]), [false, true]);
    assert.deepEqual(await page.locator(".byCODEtext").allTextContents(), ["const value = '<b>text</b>';", ""]);
    await page.locator(".byVIEWcopy").click();
    assert.equal(await page.evaluate(() => window.copied), source);
    assert.equal(await page.evaluate(() => fileViewer.setOptions({ lineNumbers: false })), true);
    assert.equal(await page.evaluate(() => byCODEviewer(root, "./example.js", { sourceType: "text" }).ready), true);
    assert.equal(await page.locator(".byCODEtext").textContent(), "./example.js");
    assert.equal(requests, 1);
  });

  await t.test("reports fetch errors and accepts empty files", async () => {
    await page.route("https://viewer.test/missing.js", (route) => route.fulfill({ status: 404, body: "Not found" }));
    assert.equal(await page.evaluate(() => byCODEviewer(root, { url: "./missing.js" }).ready), false);
    assert.match(await page.getByRole("alert").textContent(), /HTTP 404/);
    assert.equal(await page.locator("#viewer").getAttribute("aria-busy"), "false");
    await page.route("https://viewer.test/empty.js", (route) => route.fulfill({ body: "" }));
    assert.equal(await page.evaluate(() => byCODEviewer(root, { url: "./empty.js" }).ready), true);
    assert.equal(await page.getByRole("status").textContent(), "No source code.");
  });

  await t.test("destroy and replacement abort pending requests without touching a new viewer", async () => {
    const result = await page.evaluate(async () => {
      const fetch = window.fetch;
      const signals = [];
      window.fetch = (url, { signal }) => new Promise((resolve, reject) => {
        signals.push(signal);
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      try {
        const first = byCODEviewer(root, { url: "./first.js" });
        first.destroy();
        const second = byCODEviewer(root, { url: "./second.js" });
        const current = byCODEviewer(root, "current");
        return [await first.ready, await second.ready, await current.ready, ...signals.map((signal) => signal.aborted)];
      } finally {
        window.fetch = fetch;
      }
    });
    assert.deepEqual(result, [false, false, true, true, true]);
    assert.equal(await page.locator(".byCODEtext").textContent(), "current");
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
