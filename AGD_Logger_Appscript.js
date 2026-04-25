/**
 * ══════════════════════════════════════════════════════════════════════
 * CCC CONSULTANCY GROUP — AI Governance Diagnostic Activity Logger
 * Google Apps Script Web App
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com and create a new project
 * 2. Paste this entire file into the editor
 * 3. Replace SHEET_ID below with your Google Sheet's ID
 * (from the URL: docs.google.com/spreadsheets/d/SHEET_ID/edit)
 * 4. Click Deploy → New Deployment → Web App
 * - Execute as: Me
 * - Who has access: Anyone
 * 5. Copy the Web App URL and paste it into your frontend as LOGGER_ENDPOINT
 *
 * The sheet will be auto-created with headers on first run.
 * ══════════════════════════════════════════════════════════════════════
 */

const SHEET_ID = "YOUR_GOOGLE_SHEET_ID_HERE"; // ← replace this
const SHEET_NAME = "AGD_Activity_Log";
const MAX_ROWS = 50000; // safety cap — oldest rows pruned beyond this

// ── Action code decoder (obfuscated in transit, decoded here) ──────────────
const ACTION_MAP = {
  "A01": "ACCESS_GRANTED",
  "A02": "ACCESS_DENIED",
  "A03": "ACCESS_LOCKED",
  "B01": "ASSESSMENT_STARTED",
  "B02": "CONTEXT_SUBMITTED",
  "B03": "QUESTION_ANSWERED",
  "B04": "PROGRESS_SAVED",
  "B05": "PROGRESS_LOADED",
  "B06": "PROGRESS_DISCARDED",
  "C01": "REPORT_GENERATED",
  "C02": "PDF_EXPORTED",
  "C03": "ASSESSMENT_RESTARTED",
  "D01": "CTA_CALENDLY_CLICK",
  "D02": "CTA_EMAIL_CLICK",
  "D03": "FEEDBACK_SUBMITTED",
  "E01": "PAGE_VIEW",
  "E02": "SESSION_START",
};

// ── CORS headers ───────────────────────────────────────────────────────────
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

// ── OPTIONS preflight ──────────────────────────────────────────────────────
function doOptions() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST handler — main entry point ───────────────────────────────────────
function doPost(e) {
  try {
    const raw = JSON.parse(e.postData.contents);
    const decoded = decodePayload(raw);

    // Basic validation — silently drop malformed payloads
    if (!decoded.action || !decoded.session_id) {
      return respond({ status: "ignored", reason: "missing_fields" });
    }

    writeRow(decoded);
    return respond({ status: "ok" });

  } catch (err) {
    // Never let a logging error surface to the user
    console.error("Logger error:", err.message);
    return respond({ status: "error", reason: err.message });
  }
}

// ── Decode obfuscated payload ─────────────────────────────────────────────
function decodePayload(raw) {
  return {
    timestamp: raw.ts || new Date().toISOString(),
    session_id: raw.sid || "unknown",
    action: ACTION_MAP[raw.act] || raw.act || "UNKNOWN",
    action_code:raw.act || "",
    details: raw.det ? JSON.stringify(raw.det) : "",
    user_agent: raw.ua || "",
    referrer: raw.ref || "",
  };
}

// ── Write one row to the sheet ─────────────────────────────────────────────
function writeRow(data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  // Auto-create sheet with headers if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      "Timestamp (UTC)", "Session ID", "Action", "Action Code",
      "Details", "User Agent", "Referrer", "Row #"
    ];
    const headerRow = sheet.getRange(1, 1, 1, headers.length);
    headerRow.setValues([headers]);
    headerRow.setFontWeight("bold");
    headerRow.setBackground("#0c1829");
    headerRow.setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 180);
    sheet.setColumnWidth(2, 140);
    sheet.setColumnWidth(3, 200);
    sheet.setColumnWidth(5, 300);
  }

  const lastRow = sheet.getLastRow();
  const rowNum = lastRow; // row 1 = header, so last data row = lastRow-1

  // Prune if over safety cap (remove oldest data rows, keep header)
  if (lastRow > MAX_ROWS) {
    sheet.deleteRow(2); // always remove oldest data row
  }

  sheet.appendRow([
    data.timestamp,
    data.session_id,
    data.action,
    data.action_code,
    data.details,
    data.user_agent,
    data.referrer,
    lastRow, // sequential row counter
  ]);
}

// ── JSON response helper ───────────────────────────────────────────────────
function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
