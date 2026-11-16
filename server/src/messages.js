/**
 * Bilingual (TH/EN) message catalog shared by in-app notifications
 * (src/notifications.js) and status-change emails. Each entry is a function
 * of the params captured at the moment the event happened — never a Date
 * object, always JSON-safe, since notifications.js stores them verbatim in
 * Notification.params. Rendering happens here, at read time, not at
 * creation time, so a language switch (or a future catalog wording change)
 * applies to notifications that already exist, not just new ones.
 *
 * Every entry returns:
 *   { titleTh, titleEn, sentenceTh, sentenceEn, details[], highlight? }
 * - sentence is the same self-contained paragraph used both as the in-app
 *   notification body (see textFor) and as the email's lead paragraph.
 * - details is a label/value table for the email only (see emailFor) — a
 *   scannable repeat of what the sentence already says.
 * - a row is either { labelTh, labelEn, value } (language-neutral: ref no.,
 *   item text the requester typed, claim code, ...) or
 *   { labelTh, labelEn, valueTh, valueEn } (a place name or a date, which
 *   render differently per language).
 */

const locations = require("./locations");

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatThaiDate(date) {
  const d = new Date(date);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
function formatThaiDateTime(date) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatThaiDate(d)}, ${hh}:${mm} น.`;
}
// Same calendar, Common Era instead of Buddhist — never reuse formatThaiDate
// for English, its +543 is hardcoded.
function formatEnDate(date) {
  const d = new Date(date);
  return `${d.getDate()} ${EN_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function formatEnDateTime(date) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatEnDate(d)}, ${hh}:${mm}`;
}

function pickLang(th, en, lang) {
  return lang === "en" ? en : th;
}

// A place snapshot can be missing (no Location configured at all) — same
// fallback text the pre-Location code used to hardcode.
function locLine(snapshot, lang) {
  if (!snapshot) return lang === "en" ? "the registrar counter" : "เคาน์เตอร์ฝ่ายทะเบียน";
  return locations.formatText(snapshot, lang);
}

// "คำขอ RN-… / REQ-… (item)": how every requester message names the job.
// Copies are left to the email's detail table to keep the sentence short.
function leadIn(p, lang) {
  return lang === "en" ? `Request ${p.idLabel} (${p.itemList})` : `คำขอ ${p.idLabel} (${p.itemList})`;
}

// "0882313456 (Somnuk)" → "088-231-3456 (Somnuk)". Anything not starting
// with a Thai number is left as typed.
function formatPhone(raw) {
  const m = String(raw || "").match(/^\s*([0-9][0-9\s-]{7,}[0-9])\s*(.*)$/);
  if (!m) return String(raw || "").trim();
  const d = m[1].replace(/\D/g, "");
  let num = m[1].trim();
  if (/^0\d{9}$/.test(d)) num = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  else if (/^02\d{7}$/.test(d)) num = `02-${d.slice(2, 5)}-${d.slice(5)}`;
  else if (/^0\d{8}$/.test(d)) num = `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return m[2] ? `${num} ${m[2].trim()}` : num;
}

// Opening hours of a place, or the generic wording when it has none.
function hoursOf(loc, lang) {
  if (lang === "en") return loc && loc.hoursEn ? loc.hoursEn : "business hours";
  return loc && loc.hoursTh ? loc.hoursTh : "ในเวลาราชการ";
}

function baseDetails(p) {
  return [
    { labelTh: "เลขที่คำขอ", labelEn: "Reference No.", value: p.idLabel },
    { labelTh: "รายการ", labelEn: "Item", value: p.itemList },
    { labelTh: "จำนวนชุด", labelEn: "Copies", value: p.numberOfCopies }
  ];
}

// Wording rules: short sentences, one fact per line, no "—"/"·" separators.
// The sentence is the in-app notification body and the email's lead line;
// the email adds a detail table below it.
const CATALOG = {
  submitted(p) {
    const deadline = new Date(p.deadline);
    const phone = p.dropoffLocation && p.dropoffLocation.phone ? formatPhone(p.dropoffLocation.phone) : null;
    return {
      titleTh: "ได้รับคำขอแล้ว",
      titleEn: "Request received",
      sentenceTh: `${leadIn(p, "th")} บันทึกแล้ว\nกรุณานำต้นฉบับมาส่งที่ ${locLine(p.dropoffLocation, "th")} ภายใน ${formatThaiDate(deadline)}`
        + (phone ? `\nสอบถามโทร ${phone}` : ""),
      sentenceEn: `${leadIn(p, "en")} is recorded.\nPlease bring the original to ${locLine(p.dropoffLocation, "en")} by ${formatEnDate(deadline)}.`
        + (phone ? `\nQuestions: call ${phone}` : ""),
      details: [
        ...baseDetails(p),
        { labelTh: "ส่งต้นฉบับที่", labelEn: "Drop-off at", valueTh: locLine(p.dropoffLocation, "th"), valueEn: locLine(p.dropoffLocation, "en") },
        { labelTh: "ส่งภายใน", labelEn: "Drop off by", valueTh: formatThaiDate(deadline), valueEn: formatEnDate(deadline) },
        ...(phone ? [{ labelTh: "โทร", labelEn: "Phone", value: phone }] : [])
      ]
    };
  },

  approved(p) {
    const receivedAt = new Date(p.receivedAt);
    const confirmedDate = new Date(p.confirmedDate);
    return {
      titleTh: "อนุมัติคำขอแล้ว",
      titleEn: "Request approved",
      sentenceTh: `${leadIn(p, "th")} ได้รับต้นฉบับแล้ว กำลังพิมพ์\nรหัสรับเอกสาร: ${p.claimCode}\nนัดรับ: ${formatThaiDate(confirmedDate)}`,
      sentenceEn: `${leadIn(p, "en")}: original received, printing has started.\nClaim code: ${p.claimCode}\nPickup date: ${formatEnDate(confirmedDate)}`,
      highlight: { labelTh: "รหัสรับเอกสาร", labelEn: "Claim code", value: p.claimCode },
      details: [
        ...baseDetails(p),
        { labelTh: "รับต้นฉบับเมื่อ", labelEn: "Original received", valueTh: formatThaiDateTime(receivedAt), valueEn: formatEnDateTime(receivedAt) },
        { labelTh: "นัดรับ", labelEn: "Pickup date", valueTh: formatThaiDate(confirmedDate), valueEn: formatEnDate(confirmedDate) }
      ]
    };
  },

  rejected(p) {
    return {
      titleTh: "คำขอถูกปฏิเสธ",
      titleEn: "Request rejected",
      sentenceTh: `${leadIn(p, "th")} ถูกปฏิเสธ\nเหตุผล: ${p.reason}`,
      sentenceEn: `${leadIn(p, "en")} was rejected.\nReason: ${p.reason}`,
      details: [
        ...baseDetails(p),
        { labelTh: "เหตุผล", labelEn: "Reason", value: p.reason }
      ]
    };
  },

  ready(p) {
    const availableFrom = p.pickupAvailableFrom ? new Date(p.pickupAvailableFrom) : null;
    const loc = p.pickupLocation || null;
    const fromTh = availableFrom ? ` ตั้งแต่ ${formatThaiDateTime(availableFrom)}` : "";
    const fromEn = availableFrom ? ` from ${formatEnDateTime(availableFrom)}` : "";
    return {
      titleTh: "เอกสารพร้อมรับแล้ว",
      titleEn: "Ready for pickup",
      sentenceTh: `${leadIn(p, "th")} พิมพ์เสร็จแล้ว\nรับได้ที่ ${locLine(loc, "th")}${fromTh}\nเวลาทำการ: ${hoursOf(loc, "th")}\nแจ้งรหัสรับเอกสาร ${p.claimCode} เมื่อมารับ`,
      sentenceEn: `${leadIn(p, "en")} is printed.\nPick it up at ${locLine(loc, "en")}${fromEn}.\nOpening hours: ${hoursOf(loc, "en")}\nShow claim code ${p.claimCode} when you collect it.`,
      highlight: { labelTh: "รหัสรับเอกสาร", labelEn: "Claim code", value: p.claimCode },
      details: [
        ...baseDetails(p),
        { labelTh: "รับที่", labelEn: "Pickup at", valueTh: locLine(loc, "th"), valueEn: locLine(loc, "en") },
        ...(availableFrom ? [{ labelTh: "รับได้ตั้งแต่", labelEn: "Available from", valueTh: formatThaiDateTime(availableFrom), valueEn: formatEnDateTime(availableFrom) }] : []),
        { labelTh: "เวลาทำการ", labelEn: "Opening hours", valueTh: hoursOf(loc, "th"), valueEn: hoursOf(loc, "en") }
      ]
    };
  },

  completed(p) {
    const completedAt = new Date(p.completedAt);
    return {
      titleTh: "รับเอกสารเรียบร้อยแล้ว",
      titleEn: "Documents collected",
      sentenceTh: `${leadIn(p, "th")} ส่งมอบแล้วเมื่อ ${formatThaiDateTime(completedAt)}\nขอบคุณที่ใช้บริการ`,
      sentenceEn: `${leadIn(p, "en")} was collected on ${formatEnDateTime(completedAt)}.\nThank you for using our service.`,
      details: [
        ...baseDetails(p),
        { labelTh: "ส่งมอบเมื่อ", labelEn: "Collected on", valueTh: formatThaiDateTime(completedAt), valueEn: formatEnDateTime(completedAt) }
      ]
    };
  },

  // Officer-facing (no copies, no requester lead-in).
  new_request(p) {
    return {
      titleTh: "คำขอใหม่รอตรวจสอบ",
      titleEn: "New request to review",
      sentenceTh: `${p.requesterName} ส่งคำขอ ${p.idLabel} (${p.itemList})`,
      sentenceEn: `${p.requesterName} sent request ${p.idLabel} (${p.itemList}).`,
      details: [
        { labelTh: "ผู้ขอ", labelEn: "Requester", value: p.requesterName },
        ...baseDetails(p)
      ]
    };
  },

  // A place used by a still-open request was changed afterwards
  // (src/requests.js notifyLocationChange).
  dropoff_moved(p) {
    const deadline = new Date(p.deadline);
    return {
      titleTh: "เปลี่ยนสถานที่ส่งต้นฉบับ",
      titleEn: "Drop-off place changed",
      sentenceTh: `${leadIn(p, "th")} เปลี่ยนที่ส่งต้นฉบับเป็น ${locLine(p.newLocation, "th")} (เดิม ${locLine(p.oldLocation, "th")})\nส่งภายใน ${formatThaiDate(deadline)} ตามเดิม ขออภัยในความไม่สะดวก`,
      sentenceEn: `${leadIn(p, "en")}: the drop-off place is now ${locLine(p.newLocation, "en")} (was ${locLine(p.oldLocation, "en")}).\nThe deadline stays ${formatEnDate(deadline)}. Sorry for the inconvenience.`,
      details: [
        ...baseDetails(p),
        { labelTh: "ที่ใหม่", labelEn: "New place", valueTh: locLine(p.newLocation, "th"), valueEn: locLine(p.newLocation, "en") },
        { labelTh: "ที่เดิม", labelEn: "Previous place", valueTh: locLine(p.oldLocation, "th"), valueEn: locLine(p.oldLocation, "en") },
        { labelTh: "ส่งภายใน", labelEn: "Drop off by", valueTh: formatThaiDate(deadline), valueEn: formatEnDate(deadline) }
      ]
    };
  },

  pickup_moved(p) {
    const availableFrom = p.pickupAvailableFrom ? new Date(p.pickupAvailableFrom) : null;
    const fromTh = availableFrom ? ` ตั้งแต่ ${formatThaiDateTime(availableFrom)}` : "";
    const fromEn = availableFrom ? ` from ${formatEnDateTime(availableFrom)}` : "";
    return {
      titleTh: "เปลี่ยนสถานที่รับเอกสาร",
      titleEn: "Pickup place changed",
      sentenceTh: `${leadIn(p, "th")} เปลี่ยนที่รับเอกสารเป็น ${locLine(p.newLocation, "th")}${fromTh} (เดิม ${locLine(p.oldLocation, "th")})\nแจ้งรหัสรับเอกสาร ${p.claimCode} เมื่อมารับ ขออภัยในความไม่สะดวก`,
      sentenceEn: `${leadIn(p, "en")}: the pickup place is now ${locLine(p.newLocation, "en")}${fromEn} (was ${locLine(p.oldLocation, "en")}).\nShow claim code ${p.claimCode} when you collect it. Sorry for the inconvenience.`,
      highlight: { labelTh: "รหัสรับเอกสาร", labelEn: "Claim code", value: p.claimCode },
      details: [
        ...baseDetails(p),
        { labelTh: "ที่ใหม่", labelEn: "New place", valueTh: locLine(p.newLocation, "th"), valueEn: locLine(p.newLocation, "en") },
        { labelTh: "ที่เดิม", labelEn: "Previous place", valueTh: locLine(p.oldLocation, "th"), valueEn: locLine(p.oldLocation, "en") },
        { labelTh: "เวลาทำการ", labelEn: "Opening hours", valueTh: hoursOf(p.newLocation, "th"), valueEn: hoursOf(p.newLocation, "en") }
      ]
    };
  },

  cancelled(p) {
    return {
      titleTh: "ผู้ขอยกเลิกคำขอ",
      titleEn: "Request cancelled",
      sentenceTh: `${p.requesterName} ยกเลิกคำขอ ${p.idLabel} (${p.itemList}) ไม่ต้องดำเนินการต่อ`,
      sentenceEn: `${p.requesterName} cancelled request ${p.idLabel} (${p.itemList}). No action needed.`,
      details: [
        { labelTh: "ผู้ขอ", labelEn: "Requester", value: p.requesterName },
        ...baseDetails(p)
      ]
    };
  }
};

function render(type, params) {
  const fn = CATALOG[type];
  return fn ? fn(params || {}) : null;
}

function textFor(type, params, lang) {
  const content = render(type, params);
  if (!content) return null;
  return {
    title: pickLang(content.titleTh, content.titleEn, lang),
    body: pickLang(content.sentenceTh, content.sentenceEn, lang)
  };
}

function bilingualText(type, params) {
  const th = textFor(type, params, "th");
  const en = textFor(type, params, "en");
  return th ? { th, en } : null;
}

// ---- Email (table layout + inline CSS, system fonts, plain-text alt) ----

// Same palette as :root in public/assets/css/style.css (maroon/warm-white
// MFU theme) — copied as hex, not referenced, since email clients strip
// <style>/CSS variables and only render inline attribute values.
const EMAIL_COLOR = {
  primary: "#7a2e2e",
  primaryDark: "#5e2222",
  primaryTint: "#f5e9e5",
  primaryTintBorder: "#e3c7c0",
  bg: "#f7f4f0",
  surface: "#ffffff",
  border: "#e7e1d9",
  text: "#262220",
  body: "#4a4340",
  muted: "#7a716a",
  mutedLight: "#a89f97"
};

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function nl2br(s) {
  return esc(s).replace(/\n/g, "<br>");
}

function renderRow(row) {
  const valueHtml = row.valueEn !== undefined
    ? `<div style="font-size:14px;color:${EMAIL_COLOR.text};line-height:1.5;">${esc(row.valueTh)}</div>
       <div style="font-size:13px;color:${EMAIL_COLOR.muted};line-height:1.5;">${esc(row.valueEn)}</div>`
    : `<div style="font-size:14px;color:${EMAIL_COLOR.text};line-height:1.5;">${esc(row.value)}</div>`;
  return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${EMAIL_COLOR.border};vertical-align:top;width:36%;">
          <div style="font-size:13px;color:${EMAIL_COLOR.muted};">${esc(row.labelTh)}</div>
          <div style="font-size:11px;color:${EMAIL_COLOR.mutedLight};">${esc(row.labelEn)}</div>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid ${EMAIL_COLOR.border};vertical-align:top;">
          ${valueHtml}
        </td>
      </tr>`;
}

function buildEmailHtml(content) {
  const highlightHtml = content.highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;">
        <tr><td style="background:${EMAIL_COLOR.primaryTint};border:1px solid ${EMAIL_COLOR.primaryTintBorder};border-radius:6px;padding:14px 16px;">
          <div style="font-size:12px;color:${EMAIL_COLOR.primaryDark};letter-spacing:.3px;">${esc(content.highlight.labelTh)} / ${esc(content.highlight.labelEn)}</div>
          <div style="font-size:20px;font-weight:bold;color:${EMAIL_COLOR.primaryDark};font-family:'Courier New',monospace;letter-spacing:1px;">${esc(content.highlight.value)}</div>
        </td></tr>
      </table>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_COLOR.bg};padding:24px 0;font-family:Tahoma,'Noto Sans Thai','Segoe UI',Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${EMAIL_COLOR.surface};border:1px solid ${EMAIL_COLOR.border};max-width:600px;">
      <tr><td style="background:${EMAIL_COLOR.primary};padding:16px 32px;border-radius:8px 8px 0 0;">
        <div style="color:#ffffff;font-size:13px;font-weight:bold;">ระบบขอพิมพ์เอกสาร มฟล.</div>
        <div style="color:${EMAIL_COLOR.primaryTint};font-size:11px;">MFU Document Printing Request System</div>
      </td></tr>
      <tr><td style="padding:32px 32px 8px;">
        <p style="margin:0 0 4px;font-size:19px;font-weight:bold;color:${EMAIL_COLOR.text};">${esc(content.titleTh)}</p>
        <p style="margin:0 0 18px;font-size:14px;color:${EMAIL_COLOR.body};line-height:1.6;">${nl2br(content.sentenceTh)}</p>
        <p style="margin:0 0 4px;font-size:16px;font-weight:bold;color:${EMAIL_COLOR.text};">${esc(content.titleEn)}</p>
        <p style="margin:0 0 20px;font-size:13px;color:${EMAIL_COLOR.body};line-height:1.6;">${nl2br(content.sentenceEn)}</p>
        ${highlightHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${EMAIL_COLOR.border};">
          ${content.details.map(renderRow).join("")}
        </table>
      </td></tr>
      <tr><td style="background:${EMAIL_COLOR.surface};padding:22px 32px 20px;border-top:1px solid ${EMAIL_COLOR.border};border-radius:0 0 8px 8px;">
        <p style="margin:0;font-size:11px;color:${EMAIL_COLOR.muted};line-height:1.5;">อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ</p>
        <p style="margin:0;font-size:11px;color:${EMAIL_COLOR.muted};line-height:1.5;">Automated message, please do not reply.</p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

function buildEmailText(content) {
  const lines = [content.titleTh, content.sentenceTh, "", content.titleEn, content.sentenceEn, ""];
  if (content.highlight) {
    lines.push(`${content.highlight.labelTh} / ${content.highlight.labelEn}: ${content.highlight.value}`, "");
  }
  content.details.forEach((row) => {
    const value = row.valueEn !== undefined ? `${row.valueTh} / ${row.valueEn}` : row.value;
    lines.push(`${row.labelTh} / ${row.labelEn}: ${value}`);
  });
  lines.push("", "อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ", "Automated message, please do not reply.");
  return lines.join("\n");
}

function emailFor(type, params) {
  const content = render(type, params);
  if (!content) return null;
  return {
    subject: `[ODPR] ${content.titleTh} / ${content.titleEn} (${params.refNo})`,
    html: buildEmailHtml(content),
    text: buildEmailText(content)
  };
}

module.exports = {
  textFor, bilingualText, emailFor,
  formatThaiDate, formatThaiDateTime, formatEnDate, formatEnDateTime
};
