#!/usr/bin/env node

import fs from "node:fs";

const args = process.argv.slice(2);
const isDownloadMode = args[0] === "--download";
const targetUrl = isDownloadMode ? args[1] : args[0];
const outputPath = isDownloadMode ? args[2] : null;

if (!targetUrl) {
  console.error("Usage: node idx_playwright_fetch.mjs <url>");
  console.error("   or: node idx_playwright_fetch.mjs --download <url> <outputPath>");
  process.exit(1);
}

if (isDownloadMode && !outputPath) {
  console.error("Missing outputPath for --download mode");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (err) {
  console.error(
    "Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium"
  );
  process.exit(2);
}

const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: false,
});
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
});
const page = await context.newPage();

try {
  await page.goto("https://www.idx.co.id/id", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(1200);

  if (isDownloadMode) {
    const responsePayload = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/pdf,application/octet-stream,*/*",
        },
      });

      const bytes = r.ok ? Array.from(new Uint8Array(await r.arrayBuffer())) : [];
      return {
        status: r.status,
        ok: r.ok,
        contentType: r.headers.get("content-type") || "",
        bytes,
      };
    }, targetUrl);

    if (responsePayload.ok) {
      fs.writeFileSync(outputPath, Buffer.from(responsePayload.bytes));
      process.stdout.write(JSON.stringify({ status: responsePayload.status, ok: true }));
    } else {
      process.stdout.write(
        JSON.stringify({
          status: responsePayload.status,
          ok: false,
          contentType: responsePayload.contentType,
        })
      );
      process.exit(4);
    }
  } else {
    const responsePayload = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      const text = await r.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      return {
        status: r.status,
        ok: r.ok,
        contentType: r.headers.get("content-type") || "",
        data,
        bodySnippet: text.slice(0, 500),
      };
    }, targetUrl);

    process.stdout.write(JSON.stringify(responsePayload));
  }
} catch (err) {
  console.error(`Playwright fetch error: ${err?.message || String(err)}`);
  process.exit(3);
} finally {
  await browser.close();
}
