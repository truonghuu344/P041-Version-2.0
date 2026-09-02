import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const inputMd = path.join(here, "PITCH_SCRIPT.md");
const outputPdf = path.join(here, "PITCH_SCRIPT.pdf");
const tempHtml = path.join(here, "PITCH_SCRIPT.html");

if (!existsSync(inputMd)) {
  console.error(`Missing ${inputMd}`);
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
  return candidates.find((p) => existsSync(p));
}

const rawMd = readFileSync(inputMd, "utf-8");

// Parse markdown into high quality HTML sections
function renderPitchScriptToHtml(mdText) {
  // Clean raw LaTeX remnants if any
  let text = mdText
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\\rightarrow/g, '→')
    .replace(/\$\\text\{([^}]+)\}\$/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1');

  const lines = text.split('\n');
  let output = [];
  let inSlide = false;
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Horizontal rule
    if (line === '---') {
      if (inSlide) {
        output.push('</div><!-- /.slide-card -->');
        inSlide = false;
      }
      continue;
    }

    // Main Header
    if (line.startsWith('# ')) {
      output.push(`<h1>${line.replace('# ', '')}</h1>`);
      continue;
    }

    // Sub Headers (# ⏱️ Timing Summary or # 🔁 Rehearsals)
    if (line.startsWith('# ⏱️') || line.startsWith('# 🔁')) {
      if (inSlide) {
        output.push('</div>');
        inSlide = false;
      }
      output.push(`<h2 class="section-title">${line.replace(/^#\s*/, '')}</h2>`);
      continue;
    }

    // Slide Header
    if (line.startsWith('## Slide ')) {
      if (inSlide) {
        output.push('</div><!-- /.slide-card -->');
      }
      inSlide = true;
      const title = line.replace('## ', '');
      output.push(`<div class="slide-card"><div class="slide-header">${title}</div>`);
      continue;
    }

    // Blockquote at top
    if (line.startsWith('> ')) {
      output.push(`<div class="doc-meta">${line.replace('> ', '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`);
      continue;
    }

    // Table parsing
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      if (!line.includes('---')) {
        tableRows.push(line);
      }
      continue;
    } else if (inTable) {
      // Flush table
      let tHtml = '<div class="table-wrap"><table>';
      for (let r = 0; r < tableRows.length; r++) {
        const cells = tableRows[r].split('|').slice(1, -1).map(c => c.trim());
        if (r === 0) {
          tHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        } else {
          tHtml += '<tr>' + cells.map(c => `<td>${c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</td>`).join('') + '</tr>';
        }
      }
      tHtml += '</tbody></table></div>';
      output.push(tHtml);
      inTable = false;
      tableRows = [];
    }

    // Bullet points
    if (line.startsWith('- ')) {
      const content = line.substring(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      output.push(`<div class="bullet-item">• ${content}</div>`);
      continue;
    }

    // Empty lines
    if (line === '') {
      continue;
    }

    // Meta: Thời gian & Thông điệp chính
    if (line.startsWith('**Thời gian:**')) {
      const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      output.push(`<div class="meta-row">${formatted}</div>`);
      continue;
    }

    // Label: Nội dung nói
    if (line.startsWith('**Nội dung nói:**')) {
      output.push(`<div class="speech-label">NỘI DUNG NÓI (SPEAKING SCRIPT):</div>`);
      continue;
    }

    // Label: Chuyển slide
    if (line.startsWith('**Chuyển slide:**') || line.startsWith('**Chuyển slide sau khi video kết thúc:**')) {
      const transitionText = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      output.push(`<div class="transition-callout"><span class="trans-icon">↪</span> ${transitionText}</div>`);
      continue;
    }

    // Italic note like (Bật video demo...)
    if (line.startsWith('*(') && line.endsWith(')*')) {
      output.push(`<div class="stage-note">${line}</div>`);
      continue;
    }

    // Regular speech text / paragraphs
    const formattedParagraph = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    if (inSlide) {
      output.push(`<div class="speech-bubble">${formattedParagraph}</div>`);
    } else {
      output.push(`<p>${formattedParagraph}</p>`);
    }
  }

  if (inTable) {
    let tHtml = '<div class="table-wrap"><table>';
    for (let r = 0; r < tableRows.length; r++) {
      const cells = tableRows[r].split('|').slice(1, -1).map(c => c.trim());
      if (r === 0) {
        tHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
      } else {
        tHtml += '<tr>' + cells.map(c => `<td>${c.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</td>`).join('') + '</tr>';
      }
    }
    tHtml += '</tbody></table></div>';
    output.push(tHtml);
  }

  if (inSlide) {
    output.push('</div>');
  }

  return output.join('\n');
}

const htmlBody = renderPitchScriptToHtml(rawMd);

const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Kịch bản Thuyết trình Demo Day — Career Assistant</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: A4;
      margin: 16mm 14mm 16mm 14mm;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.55;
      font-size: 10pt;
    }
    h1 {
      font-size: 18pt;
      font-weight: 900;
      color: #0d1a12;
      border-bottom: 2.5px solid #059669;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .doc-meta {
      font-size: 9pt;
      color: #475569;
      background: #f8fafc;
      padding: 6px 12px;
      border-left: 3px solid #059669;
      border-radius: 0 4px 4px 0;
      margin-bottom: 4px;
    }
    .section-title {
      font-size: 13pt;
      font-weight: 800;
      color: #047857;
      margin-top: 24px;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1.5px solid #a7f3d0;
      page-break-after: avoid;
    }
    .slide-card {
      margin-top: 14px;
      margin-bottom: 16px;
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      padding: 12px 16px;
      page-break-inside: avoid;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .slide-header {
      font-size: 12.5pt;
      font-weight: 800;
      color: #047857;
      background: #ecfdf5;
      margin: -12px -16px 10px -16px;
      padding: 8px 16px;
      border-bottom: 1.5px solid #a7f3d0;
      border-radius: 7px 7px 0 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-row {
      font-size: 9pt;
      color: #334155;
      background: #f8fafc;
      padding: 6px 10px;
      border-radius: 5px;
      margin-bottom: 10px;
      line-height: 1.45;
      border: 1px solid #f1f5f9;
    }
    .meta-row strong {
      color: #0f172a;
    }
    .speech-label {
      font-size: 8pt;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #059669;
      margin-bottom: 4px;
    }
    .speech-bubble {
      font-size: 10pt;
      color: #0f172a;
      line-height: 1.6;
      background: #fafafa;
      padding: 10px 14px;
      border-left: 3.5px solid #059669;
      border-radius: 0 6px 6px 0;
      margin-bottom: 8px;
      font-style: normal;
    }
    .transition-callout {
      font-size: 9pt;
      color: #065f46;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      padding: 6px 12px;
      border-radius: 6px;
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      line-height: 1.4;
    }
    .trans-icon {
      font-weight: 900;
      color: #059669;
      font-size: 11pt;
    }
    .stage-note {
      font-size: 9pt;
      color: #64748b;
      font-style: italic;
      background: #f1f5f9;
      padding: 6px 10px;
      border-radius: 4px;
      margin: 6px 0;
    }
    .bullet-item {
      font-size: 9.5pt;
      color: #1e293b;
      margin-left: 10px;
      margin-bottom: 4px;
      line-height: 1.5;
    }
    .table-wrap {
      margin: 12px 0;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 4px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      font-weight: 700;
      color: #0f172a;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .footer-bar {
      text-align: center;
      font-size: 8pt;
      color: #94a3b8;
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  ${htmlBody}
  <div class="footer-bar">
    Career Assistant · Team 041 WinTop · Demo Day 03/09/2026
  </div>
</body>
</html>`;

writeFileSync(tempHtml, fullHtml, "utf-8");

async function exportPdf() {
  const puppeteer = require("puppeteer-core");
  const chromePath = findChrome();
  if (!chromePath) {
    console.error("Chrome / Edge executable not found.");
    process.exit(1);
  }

  console.log(`[export] Launching browser: ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  const fileUrl = "file://" + tempHtml.replace(/\\\\/g, "/");
  console.log(`[export] Navigating to: ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: "networkidle0" });

  console.log(`[export] Printing PDF to: ${outputPdf}`);
  await page.pdf({
    path: outputPdf,
    format: "A4",
    printBackground: true,
    margin: {
      top: "16mm",
      bottom: "16mm",
      left: "14mm",
      right: "14mm"
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:8pt; font-family:sans-serif; width:100%; text-align:right; padding-right:14mm; color:#94a3b8;">Trang <span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });

  await browser.close();
  console.log(`[export] Successfully exported PDF: ${outputPdf}`);
}

exportPdf().catch((err) => {
  console.error("[export] Error:", err);
  process.exit(1);
});
