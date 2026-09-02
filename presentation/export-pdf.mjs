#!/usr/bin/env node
/**
 * Automated PDF export for the Career Assistant X deck.
 *
 * Usage:
 *   npm install          (first run, inside /presentation)
 *   npm run presentation:pdf
 *
 * Renders presentation/index.html at exactly 1280x720 per page with a
 * headless Chromium (system Chrome/Edge via puppeteer-core, no download).
 * Output: presentation/Career-Assistant-Presentation.pdf
 */
import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const input = path.join(here, "index.html");
const output = path.join(here, "Career-Assistant-Presentation.pdf");

if (!existsSync(input)) {
  console.error(`[export-pdf] Missing ${input}`);
  process.exit(1);
}

function findChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error(
      "[export-pdf] No Chrome/Edge found. Set PUPPETEER_EXECUTABLE_PATH to your browser executable."
    );
    process.exit(1);
  }
  return found;
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer-core");
  } catch {
    console.error('[export-pdf] puppeteer-core missing. Run: npm install (in /presentation)');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",
      "--force-color-profile=srgb",
      "--disable-lcd-text",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });

    // Collect console errors so broken assets don't slip through silently.
    page.on("pageerror", (e) => console.warn("[pageerror]", e.message));
    page.on("requestfailed", (r) =>
      console.warn("[requestfailed]", r.url(), r.failure()?.errorText)
    );

    await page.goto(pathToFileURL(input).href, { waitUntil: "networkidle0" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      if (document.fonts.status !== "loaded") {
        await new Promise((r) => setTimeout(r, 1500));
      }
    });
    // Small settle delay for layout after font swap.
    await new Promise((r) => setTimeout(r, 300));

    // Sanity check: every slide must be laid out and visible for print.
    const audit = await page.evaluate(() => {
      const slides = [...document.querySelectorAll(".slide")];
      return {
        count: slides.length,
        emptyText: slides.filter((s) => s.textContent.trim().length < 20).length,
        title: document.title,
        fontsLoaded: document.fonts.status,
      };
    });
    if (audit.emptyText > 0 || audit.count < 10) {
      console.error("[export-pdf] Slide audit failed:", audit);
      process.exit(1);
    }
    console.log(
      `[export-pdf] ${audit.count} slides · fonts: ${audit.fontsLoaded} → printing…`
    );

    await page.pdf({
      path: output,
      printBackground: true,
      width: "1280px",
      height: "720px",
      pageRanges: `1-${audit.count}`,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: false,
    });
  } finally {
    await browser.close();
  }

  const docsOutput = path.join(here, "..", "docs", "pitch-deck.pdf");
  try {
    const { copyFileSync } = await import("node:fs");
    copyFileSync(output, docsOutput);
  } catch (err) {
    console.warn("[export-pdf] Could not copy to docs/pitch-deck.pdf:", err.message);
  }

  const kb = Math.round(statSync(output).size / 1024);
  console.log(`[export-pdf] OK → ${output} (${kb} KB) & docs/pitch-deck.pdf`);
}

main().catch((err) => {
  console.error("[export-pdf] FAILED:", err);
  process.exit(1);
});
