import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push("CONSOLE: " + msg.text()); });
page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message));
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
console.log("errors:", errors);

const info = await page.evaluate(() => {
  const subs = Array.from(document.querySelectorAll(".hero-sub"));
  const cards = Array.from(document.querySelectorAll(".hero-card"));
  const describe = (el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return { opacity: cs.opacity, transform: cs.transform, display: cs.display, visibility: cs.visibility, rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } };
  };
  return {
    subCount: subs.length,
    subs: subs.map(describe),
    cardCount: cards.length,
    cards: cards.map(describe),
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
