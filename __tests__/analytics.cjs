/* Website consent lifecycle. All browser requests are fulfilled locally. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");
const { chromium } = require("playwright");

test("the public website gates the tag, sanitizes events and withdraws pending work", async (t) => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL });
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();
  const website = await fs.readFile(path.join(__dirname, "../index.html"), "utf8");
  let loads = 0;
  const increments = [];
  // ===== BROWSER REQUEST FIXTURES =====
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.href === "https://byuwur.co/usage.php") {
      const request = route.request();
      const headers = await request.allHeaders();
      const [action, surface, resource] = request.postData().split("|");
      increments.push({
        action,
        surface,
        resource,
        origin: headers.origin,
        cookie: headers.cookie,
        referrer: headers.referer
      });
      return route.fulfill({
        status: 204,
        headers: { "Access-Control-Allow-Origin": "https://code.byuwur.co" }
      });
    }
    if (url.hostname === "www.googletagmanager.com") {
      loads++;
      // Simulate a loaded tag without contacting Google or using the property.
      return route.fulfill({ contentType: "application/javascript", body: "window.testTagLoaded = true;" });
    }
    if (url.href === "https://cdn.jsdelivr.net/gh/byuwur/spa.js@v20.18/_privacy.min.js") {
      // Exercise the site's consent callback without a framework checkout or network access.
      return route.fulfill({
        contentType: "application/javascript",
        body: `
        window.byCommon = { initPrivacyControls({ onChoice }) {
          window.chooseAnalytics = onChoice;
          return { update() {}, open() {} };
        } };
      `
      });
    }
    if (route.request().isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: website });
    return route.abort();
  });
  const url = "https://code.byuwur.co/?token=private-sentinel#private-sentinel";
  const events = () => page.evaluate(() => (document.querySelector('iframe[title="Google Analytics"]')?.contentWindow.dataLayer || []).filter((cmd) => cmd[0] === "event").map((cmd) => [cmd[1], cmd[2]]));
  // ===== INVALID AND EXPIRED CONSENT =====
  for (const value of ["invalid", "v1.yes.1000000000"]) {
    await context.addCookies([{ name: "byuwur_analytics", value, domain: ".byuwur.co", path: "/", secure: true }]);
    // ===== BROWSER INTERACTIONS =====
    await page.goto(url);
    assert.equal(loads, 0);
  }
  await page.waitForFunction(() => typeof window.chooseAnalytics === "function");
  await page.waitForLoadState("networkidle");
  const count = increments.length;
  const copiedHit = page.waitForResponse((response) => response.url() === "https://byuwur.co/usage.php" && response.request().postData().startsWith("resource_copied|"));
  await page.evaluate(() => window.bySiteAnalytics.begin("resource_copied")());
  await copiedHit;
  await page.waitForLoadState("networkidle");
  assert.equal(increments.length, count + 1);
  assert.deepEqual(increments.at(-1), {
    action: "resource_copied",
    surface: "landing",
    resource: "code_view",
    origin: "https://code.byuwur.co",
    cookie: undefined,
    referrer: undefined
  });
  assert.ok(increments.some((hit) => hit.action === "page_view"));
  await page.evaluate(() => window.chooseAnalytics("no"));
  await page.waitForLoadState("networkidle");
  assert.equal(increments.length, count + 1, "rejecting does not recount the current page");
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.equal(increments.length, count + 2);
  assert.deepEqual(increments.at(-1), {
    action: "page_view",
    surface: "landing",
    resource: "code_view",
    origin: "https://code.byuwur.co",
    cookie: undefined,
    referrer: undefined
  });
  assert.equal(loads, 0);
  assert.equal(await page.evaluate(() => window.bySiteAnalytics.begin("resource_loaded") === undefined), true);
  await page.waitForFunction(() => typeof window.chooseAnalytics === "function");
  // ===== ACCEPTED ANALYTICS =====
  await page.evaluate(() => window.chooseAnalytics("yes"));
  await page.waitForFunction(() => document.querySelector('iframe[title="Google Analytics"]')?.contentWindow.testTagLoaded);
  assert.equal(loads, 1);
  const frameDocument = await page.locator('iframe[title="Google Analytics"]').evaluate((frame) => ({
    url: frame.contentDocument.URL,
    referrer: frame.contentDocument.referrer
  }));
  assert.deepEqual(frameDocument, { url: "https://code.byuwur.co/", referrer: "" });
  assert.deepEqual(
    (await events()).map(([name]) => name),
    ["page_view"]
  );
  const config = await page.evaluate(() => Array.from(document.querySelector('iframe[title="Google Analytics"]')?.contentWindow.dataLayer.find((cmd) => cmd[0] === "config")));
  assert.equal(config[2].send_page_view, false);
  assert.equal(config[2].page_location, "https://code.byuwur.co/");
  assert.equal(config[2].allow_ad_personalization_signals, false);
  await page.evaluate(() => {
    const analytics = window.bySiteAnalytics;
    analytics.begin("configuration_changed", "wordWrap")();
    analytics.begin("configuration_changed", "private-sentinel")?.();
    analytics.begin("resource_copied")();
    window.pendingCopy = analytics.begin("resource_copied");
    document.cookie = "_ga=test; Domain=byuwur.co; Path=/; Secure";
    document.cookie = "_ga_YBLWBPK758=test; Domain=byuwur.co; Path=/; Secure";
    document.cookie = "functional=keep; Path=/; Secure";
  });
  const measured = await events();
  await page.waitForLoadState("networkidle");
  assert.equal(increments.filter((hit) => hit.action === "configuration_changed").length, 1);
  assert.equal(increments.filter((hit) => hit.action === "resource_copied").length, 2);
  assert.ok(!JSON.stringify(increments).includes("private-sentinel"));
  assert.deepEqual(
    measured.map(([name]) => name),
    ["page_view", "tool_used", "tool_used"]
  );
  assert.equal(measured[1][1].field_id, "word_wrap");
  assert.ok(!Object.hasOwn(measured[2][1], "field_id"));
  assert.ok(!JSON.stringify(measured).includes("private-sentinel"));
  await page.evaluate(() => window.chooseAnalytics("no"));
  // ===== WITHDRAWAL AND EXCLUDED ROUTES =====
  const beforeWithdrawal = increments.length;
  await page.evaluate(() => window.pendingCopy());
  await page.waitForLoadState("networkidle");
  assert.equal(increments.length, beforeWithdrawal);
  assert.equal((await events()).length, 0);
  assert.equal(await page.evaluate(() => window["ga-disable-G-YBLWBPK758"]), true);
  const cookies = await context.cookies();
  assert.ok(!cookies.some((cookie) => cookie.name.startsWith("_ga")));
  assert.ok(cookies.some((cookie) => cookie.name === "functional"));
  for (const location of ["https://code.byuwur.co/unknown", "https://preview.test/"]) {
    await page.goto(location);
    assert.equal(await page.evaluate(() => typeof window.chooseAnalytics), "undefined");
    assert.equal(loads, 1);
  }
});
