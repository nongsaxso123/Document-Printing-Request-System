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

// The "Request X: item (N copies)" lead-in every Requester-facing sentence
// starts with, kept as one helper so it reads identically across statuses.
function leadIn(p, lang) {
  return lang === "en"
    ? `Request ${p.idLabel}: ${p.itemList} (${p.numberOfCopies} copies)`
    : `คำขอ ${p.idLabel}: ${p.itemList} (${p.numberOfCopies} ชุด)`;
}

function baseDetails(p) {
  return [
    { labelTh: "เลขที่คำขอ", labelEn: "Reference No.", value: p.idLabel },
    { labelTh: "รายการ", labelEn: "Item", value: p.itemList },
    { labelTh: "จำนวนชุด", labelEn: "Copies", value: p.numberOfCopies }
  ];
}

const CATALOG = {
  submitted(p) {
    const deadline = new Date(p.deadline);
    const phone = p.dropoffLocation && p.dropoffLocation.phone;
    return {
      titleTh: "ได้รับคำขอพิมพ์เอกสารของคุณแล้ว",
      titleEn: "Your document printing request has been received",
      sentenceTh: `${leadIn(p, "th")} ถูกบันทึกเข้าระบบเรียบร้อยแล้ว กรุณานำเอกสารต้นฉบับมาส่งที่ ${locLine(p.dropoffLocation, "th")} ภายในวันที่ ${formatThaiDate(deadline)}`
        + (phone ? `\nหากมีข้อสงสัย ติดต่อเจ้าหน้าที่ที่ ${phone}` : ""),
      sentenceEn: `${leadIn(p, "en")} has been recorded. Please submit the original document at ${locLine(p.dropoffLocation, "en")} by ${formatEnDate(deadline)}`
        + (phone ? `\nFor questions, contact ${phone}` : ""),
      details: [
        ...baseDetails(p),
        { labelTh: "สถานที่ส่งเอกสาร", labelEn: "Drop-off location", valueTh: locLine(p.dropoffLocation, "th"), valueEn: locLine(p.dropoffLocation, "en") },
        { labelTh: "กำหนดส่งต้นฉบับ", labelEn: "Submission deadline", valueTh: formatThaiDate(deadline), valueEn: formatEnDate(deadline) },
        ...(phone ? [{ labelTh: "โทรศัพท์ติดต่อ", labelEn: "Phone", value: phone }] : [])
      ]
    };
  },

  approved(p) {
    const receivedAt = new Date(p.receivedAt);
    const confirmedDate = new Date(p.confirmedDate);
    return {
      titleTh: "คำขอของคุณได้รับการอนุมัติแล้ว",
      titleEn: "Your request has been approved",
      sentenceTh: `${leadIn(p, "th")} รับเอกสารต้นฉบับแล้วเมื่อ ${formatThaiDateTime(receivedAt)} และเริ่มดำเนินการพิมพ์\nรหัสรับเอกสาร (Claim Code): ${p.claimCode}\nวันที่นัดรับ: ${formatThaiDate(confirmedDate)}`,
      sentenceEn: `${leadIn(p, "en")} — the original document was received on ${formatEnDateTime(receivedAt)} and printing has started.\nClaim Code: ${p.claimCode}\nScheduled pickup date: ${formatEnDate(confirmedDate)}`,
      highlight: { labelTh: "รหัสรับเอกสาร", labelEn: "Claim Code", value: p.claimCode },
      details: [
        ...baseDetails(p),
        { labelTh: "รับเอกสารต้นฉบับเมื่อ", labelEn: "Original received", valueTh: formatThaiDateTime(receivedAt), valueEn: formatEnDateTime(receivedAt) },
        { labelTh: "วันที่นัดรับ", labelEn: "Scheduled pickup date", valueTh: formatThaiDate(confirmedDate), valueEn: formatEnDate(confirmedDate) }
      ]
    };
  },

  rejected(p) {
    return {
      titleTh: "คำขอของคุณถูกปฏิเสธ",
      titleEn: "Your request has been rejected",
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
    const availableThLine = availableFrom ? ` ตั้งแต่ ${formatThaiDateTime(availableFrom)} เป็นต้นไป (ในเวลาราชการ)` : " ในเวลาราชการ";
    const availableEnLine = availableFrom ? ` from ${formatEnDateTime(availableFrom)} onwards (business hours)` : " during business hours";
    return {
      titleTh: "เอกสารของคุณพร้อมให้รับแล้ว",
      titleEn: "Your documents are ready for pickup",
      sentenceTh: `${leadIn(p, "th")} พิมพ์เสร็จเรียบร้อยแล้ว กรุณามารับเอกสารที่ ${locLine(p.pickupLocation, "th")}${availableThLine} พร้อมแจ้งรหัสรับเอกสาร (Claim Code): ${p.claimCode}`,
      sentenceEn: `${leadIn(p, "en")} has been printed. Please collect it at ${locLine(p.pickupLocation, "en")}${availableEnLine} and present the claim code: ${p.claimCode}`,
      highlight: { labelTh: "รหัสรับเอกสาร", labelEn: "Claim Code", value: p.claimCode },
      details: [
        ...baseDetails(p),
        { labelTh: "สถานที่รับเอกสาร", labelEn: "Pickup location", valueTh: locLine(p.pickupLocation, "th"), valueEn: locLine(p.pickupLocation, "en") },
        {
          labelTh: "รับเอกสารได้ตั้งแต่", labelEn: "Available for pickup from",
          valueTh: availableFrom ? `${formatThaiDateTime(availableFrom)} เป็นต้นไป (ในเวลาราชการ)` : "ในเวลาราชการ",
          valueEn: availableFrom ? `${formatEnDateTime(availableFrom)} onwards (business hours)` : "During business hours"
        }
      ]
    };
  },

  completed(p) {
    const completedAt = new Date(p.completedAt);
    return {
      titleTh: "ส่งมอบเอกสารเรียบร้อยแล้ว",
      titleEn: "Documents delivered",
      sentenceTh: `${leadIn(p, "th")} ได้รับการส่งมอบเรียบร้อยแล้วเมื่อ ${formatThaiDateTime(completedAt)} ขอบคุณที่ใช้บริการ`,
      sentenceEn: `${leadIn(p, "en")} has been delivered on ${formatEnDateTime(completedAt)}. Thank you for using our service.`,
      details: [
        ...baseDetails(p),
        { labelTh: "ส่งมอบเมื่อ", labelEn: "Delivered on", valueTh: formatThaiDateTime(completedAt), valueEn: formatEnDateTime(completedAt) }
      ]
    };
  },

  // Officer-facing — not a Requester status, so no leadIn() (that mentions
  // copies, which these two never did) or ref-no prefix inside the sentence.
  new_request(p) {
    return {
      titleTh: "มีคำขอพิมพ์เอกสารใหม่รอตรวจสอบ",
      titleEn: "New document printing request awaiting review",
      sentenceTh: `${p.requesterName} ส่งคำขอ ${p.idLabel} (${p.itemList}) เข้ามาใหม่ กรุณาตรวจสอบเอกสารต้นฉบับที่คิว`,
      sentenceEn: `${p.requesterName} submitted a new request ${p.idLabel} (${p.itemList}). Please review the original document in the queue.`,
      details: [
        { labelTh: "ผู้ขอ", labelEn: "Requester", value: p.requesterName },
        ...baseDetails(p)
      ]
    };
  },

  // D — sent to a requester whose request is still in-flight at a place
  // that just got edited-and-flagged-as-moved, or archived with a
  // replacement chosen (src/requests.js notifyLocationChange). Distinct
  // from submitted/ready above (which restate the place that was already
  // true when they fired) — this one exists specifically to call out that
  // it changed after the fact.
  dropoff_moved(p) {
    const deadline = new Date(p.deadline);
    return {
      titleTh: "สถานที่ส่งเอกสารมีการเปลี่ยนแปลง",
      titleEn: "Drop-off location has changed",
      sentenceTh: `${leadIn(p, "th")} เปลี่ยนสถานที่ส่งเอกสารต้นฉบับ จากเดิม ${locLine(p.oldLocation, "th")} เป็น ${locLine(p.newLocation, "th")} กรุณานำเอกสารต้นฉบับมาส่งที่แห่งใหม่ภายในวันที่ ${formatThaiDate(deadline)} ตามกำหนดเดิม ขออภัยในความไม่สะดวก`,
      sentenceEn: `${leadIn(p, "en")}: the drop-off location has changed from ${locLine(p.oldLocation, "en")} to ${locLine(p.newLocation, "en")}. Please submit the original document at the new location by ${formatEnDate(deadline)}, as originally scheduled. We apologize for the inconvenience.`,
      details: [
        ...baseDetails(p),
        { labelTh: "สถานที่เดิม", labelEn: "Previous location", valueTh: locLine(p.oldLocation, "th"), valueEn: locLine(p.oldLocation, "en") },
        { labelTh: "สถานที่ใหม่", labelEn: "New location", valueTh: locLine(p.newLocation, "th"), valueEn: locLine(p.newLocation, "en") },
        { labelTh: "กำหนดส่งต้นฉบับ", labelEn: "Submission deadline", valueTh: formatThaiDate(deadline), valueEn: formatEnDate(deadline) }
      ]
    };
  },

  pickup_moved(p) {
    const availableFrom = p.pickupAvailableFrom ? new Date(p.pickupAvailableFrom) : null;
    const availableThLine = availableFrom ? ` ตั้งแต่ ${formatThaiDateTime(availableFrom)} เป็นต้นไป (ในเวลาราชการ)` : "";
    const availableEnLine = availableFrom ? ` from ${formatEnDateTime(availableFrom)} onwards (business hours)` : "";
    return {
      titleTh: "สถานที่รับเอกสารมีการเปลี่ยนแปลง",
      titleEn: "Pickup location has changed",
      sentenceTh: `${leadIn(p, "th")} เปลี่ยนสถานที่รับเอกสาร จากเดิม ${locLine(p.oldLocation, "th")} เป็น ${locLine(p.newLocation, "th")}${availableThLine} กรุณามารับที่แห่งใหม่ พร้อมแจ้งรหัสรับเอกสาร (Claim Code): ${p.claimCode} ขออภัยในความไม่สะดวก`,
      sentenceEn: `${leadIn(p, "en")}: the pickup location has changed from ${locLine(p.oldLocation, "en")} to ${locLine(p.newLocation, "en")}${availableEnLine}. Please collect it at the new location and present the claim code: ${p.claimCode}. We apologize for the inconvenience.`,
      highlight: { labelTh: "รหัสรับเอกสาร", labelEn: "Claim Code", value: p.claimCode },
      details: [
        ...baseDetails(p),
        { labelTh: "สถานที่เดิม", labelEn: "Previous location", valueTh: locLine(p.oldLocation, "th"), valueEn: locLine(p.oldLocation, "en") },
        { labelTh: "สถานที่ใหม่", labelEn: "New location", valueTh: locLine(p.newLocation, "th"), valueEn: locLine(p.newLocation, "en") }
      ]
    };
  },

  cancelled(p) {
    return {
      titleTh: "คำขอถูกยกเลิกโดยผู้ขอ",
      titleEn: "Request cancelled by requester",
      sentenceTh: `${p.requesterName} ยกเลิกคำขอ ${p.idLabel} (${p.itemList}) แล้ว ไม่ต้องดำเนินการต่อ`,
      sentenceEn: `${p.requesterName} has cancelled request ${p.idLabel} (${p.itemList}) — no further action needed.`,
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
    subject: `[ODPRS] ${content.titleTh} / ${content.titleEn} (${params.refNo})`,
    html: buildEmailHtml(content),
    text: buildEmailText(content)
  };
}

module.exports = {
  textFor, bilingualText, emailFor,
  formatThaiDate, formatThaiDateTime, formatEnDate, formatEnDateTime
};
