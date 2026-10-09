/**
 * Business-day math for FR-04/FR-05 — ported from prototype/assets/js/app.js
 * so the server can re-validate the completion date and compute the
 * drop-off deadline itself (never trust the client alone).
 */

const BUSINESS_HOUR_START = 9;
const BUSINESS_HOUR_END = 15;

// BR-02/BR-03 — a business day is Monday-Friday; Saturday/Sunday are
// government non-working days and never count, regardless of how many
// copies or how urgent the request is. (Thai public holidays that fall on
// a weekday are a known gap — not tracked yet, see file.md Appendix B.)
function isBusinessDay(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addBusinessDays(date, count) {
  let d = new Date(date);
  let added = 0;
  while (added < count) {
    d = addDays(d, 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

function nextBusinessDay(date) {
  let d = addDays(date, 1);
  while (!isBusinessDay(d)) d = addDays(d, 1);
  return d;
}

/** Earliest completion/appointment date a Requester may propose: submission + 3 business days. */
function minCompletionDate(submissionDate) {
  return addBusinessDays(submissionDate, 3);
}

// A decimal hour (e.g. 16.5 for 16:30, from locations.hourWindowOf) split
// into Date#setHours' separate hour/minute args — setHours(16.5) would
// truncate straight to 16:00 and silently drop the minutes.
function setClockHour(date, hourDecimal) {
  date.setHours(Math.floor(hourDecimal), Math.round((hourDecimal % 1) * 60), 0, 0);
  return date;
}

// The deadline is a cutoff, not a snapshot of submission time — always the
// closing hour on the deadline day. (Returning the raw submission instant
// here used to mean the deadline was already "in the past" the moment it
// was computed, so every request read as Overdue immediately.) hourEnd
// defaults to the site-wide constant; a caller with a specific Location's
// real hours (src/locations.js hourWindowOf) passes its close time instead.
function atDropoffCutoff(date, hourEnd = BUSINESS_HOUR_END) {
  return setClockHour(new Date(date), hourEnd);
}

/**
 * Deadline for hand-delivering the physical original documents.
 * Same business day by closing time if submitted on a business day before
 * then (whether or not the counter has opened yet that day); otherwise the
 * next business day. hourEnd is the drop-off place's real closing hour
 * (src/locations.js hourWindowOf) — the site-wide constant when the place
 * has no structured hours, or none was chosen at all.
 */
function computeDropoffDeadline(submissionDate, hourEnd = BUSINESS_HOUR_END) {
  const hour = submissionDate.getHours() + submissionDate.getMinutes() / 60;

  if (isBusinessDay(submissionDate) && hour < hourEnd) {
    return { date: atDropoffCutoff(submissionDate, hourEnd), sameDay: true };
  }

  return { date: atDropoffCutoff(nextBusinessDay(submissionDate), hourEnd), sameDay: false };
}

module.exports = { BUSINESS_HOUR_START, BUSINESS_HOUR_END, isBusinessDay, addDays, addBusinessDays, nextBusinessDay, minCompletionDate, computeDropoffDeadline, setClockHour };
