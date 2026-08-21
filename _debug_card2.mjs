import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error" || msg.type() === "warning") errors.push(msg.type()+": " + msg.text()); });
page.on("pageerror", (err) => errors.push("PAGEERROR: " + err.message + "\n" + err.stack));
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
console.log("=== console errors/warnings ===");
errors.forEach(e => console.log(e));

const html = await page.evaluate(() => {
  const heroSection = document.querySelector("section");
  return heroSection ? heroSection.innerHTML.length : "no section";
});
console.log("hero section innerHTML length:", html);

const gridInfo = await page.evaluate(() => {
  // find the grid that should contain the two hero cards
  const grids = document.querySelectorAll(".grid");
  return Array.from(grids).map((g, i) => ({
    index: i,
    className: g.className,
    childCount: g.children.length,
    childrenClasses: Array.from(g.children).map(c => c.className),
  }));
});
console.log("=== all .grid elements ===");
console.log(JSON.stringify(gridInfo, null, 2));
await browser.close();
