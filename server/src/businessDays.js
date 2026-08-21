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

// The deadline is a cutoff, not a snapshot of submission time — always
// 15:00:00 on the deadline day. (Returning the raw submission instant here
// used to mean the deadline was already "in the past" the moment it was
// computed, so every request read as Overdue immediately.)
function atDropoffCutoff(date) {
  const d = new Date(date);
  d.setHours(BUSINESS_HOUR_END, 0, 0, 0);
  return d;
}

/**
 * Deadline for hand-delivering the physical original documents.
 * Same business day by 15:00 if submitted on a business day before 15:00
 * (whether or not the counter has opened yet that day); otherwise the next
 * business day, 09:00-15:00.
 */
function computeDropoffDeadline(submissionDate) {
  const hour = submissionDate.getHours() + submissionDate.getMinutes() / 60;

  if (isBusinessDay(submissionDate) && hour < BUSINESS_HOUR_END) {
    return { date: atDropoffCutoff(submissionDate), sameDay: true };
  }

  return { date: atDropoffCutoff(nextBusinessDay(submissionDate)), sameDay: false };
}

module.exports = { isBusinessDay, addDays, addBusinessDays, nextBusinessDay, minCompletionDate, computeDropoffDeadline };
