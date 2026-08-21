import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push("CONSOLE: " + msg.text()); });
page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message + "\n" + err.stack));
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
console.log("=== errors ===");
errors.forEach(e => console.log(e));

const info = await page.evaluate(() => {
  const cards = document.querySelectorAll(".hero-card");
  return Array.from(cards).map((el, i) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      index: i,
      opacity: cs.opacity,
      transform: cs.transform,
      visibility: cs.visibility,
      display: cs.display,
      rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      innerTextSample: el.innerText.slice(0, 60),
    };
  });
});
console.log("=== .hero-card elements ===");
console.log(JSON.stringify(info, null, 2));
await browser.close();
