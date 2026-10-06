// Opens the real F&F app, signs in as admin, uses the "Ask F&F" chat panel,
// and saves screenshots. Requires the F&F dev server and n8n to be running.
//   node automation/n8n/test-chat-ui.cjs [baseUrl=http://localhost:8080]
const { chromium } = require("playwright");
const path = require("path");

const base = process.argv[2] || "http://localhost:8080";
const out = path.join(__dirname, "previews");

(async () => {
  require("fs").mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5 });
  page.setDefaultNavigationTimeout(240000);
  page.setDefaultTimeout(120000);
  page.on("console", (m) => { if (m.type() === "error") console.log("  [browser error]", m.text().slice(0, 200)); });

  await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !document.body.innerText.includes("Initialising session"), { timeout: 30000 }).catch(() => {});
  await page.locator('input[type="email"]').fill("admin@forgefabric.com");
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: /Sign In/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });
  await page.goto(base + "/orders", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const launcher = page.getByRole("button", { name: "Open F&F Ops Assistant" });
  await launcher.waitFor({ timeout: 20000 });
  await page.screenshot({ path: path.join(out, "chat-1-launcher.png") });
  await launcher.click();
  await page.screenshot({ path: path.join(out, "chat-2-open.png") });

  const ask = async (text) => {
    const before = await page.locator('[role="dialog"] .rounded-bl-md').count();
    await page.getByRole("textbox", { name: "Message" }).fill(text);
    await page.getByRole("button", { name: "Send" }).click();
    await page.waitForFunction((n) => document.querySelectorAll('[role="dialog"] .rounded-bl-md, [role="dialog"] .text-destructive').length > n, before, { timeout: 90000 });
    const last = page.locator('[role="dialog"] .rounded-bl-md, [role="dialog"] .text-destructive').last();
    console.log("\n>>> " + text + "\n" + (await last.innerText()));
  };

  await ask("Where is FF-2026-00010?");
  await page.screenshot({ path: path.join(out, "chat-3-answer.png") });
  await page.waitForTimeout(6000);
  await ask("Put FF-2026-00009 on hold because the buyer has not approved the trims yet");
  await page.screenshot({ path: path.join(out, "chat-4-proposal.png") });

  const cancelBtn = page.getByRole("button", { name: "Cancel" }).last();
  if (await cancelBtn.isVisible().catch(() => false)) {
    await cancelBtn.click();
    await page.waitForTimeout(4000);
    console.log("\n>>> [clicked Cancel]\n" + (await page.locator('[role="dialog"] .rounded-bl-md').last().innerText()));
    await page.screenshot({ path: path.join(out, "chat-5-cancelled.png") });
  } else {
    console.log("(no confirm/cancel buttons shown)");
  }
  await browser.close();
})().catch((e) => { console.error("UI TEST ERROR:", e.message); process.exit(1); });
