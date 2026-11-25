// Unit tests for src/businessDays.js (FR-04/FR-05, BR-02/BR-03).
// Run with: npm test
//
// Dates are built with the local-time Date constructor (month is 0-based),
// the same way the app reads them, so these pass in any timezone.
// Reference week (November 2026):
//   Mon 23, Tue 24, Wed 25, Thu 26, Fri 27, Sat 28, Sun 29, Mon 30

const test = require("node:test");
const assert = require("node:assert/strict");
const bd = require("../src/businessDays");

const nov = (day, hour = 10, minute = 0) => new Date(2026, 10, day, hour, minute);
const sameDate = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

test("isBusinessDay: Monday to Friday count, Saturday and Sunday do not", () => {
  assert.equal(bd.isBusinessDay(nov(23)), true); // Mon (boundary: first weekday)
  assert.equal(bd.isBusinessDay(nov(25)), true); // Wed
  assert.equal(bd.isBusinessDay(nov(27)), true); // Fri (boundary: last weekday)
  assert.equal(bd.isBusinessDay(nov(28)), false); // Sat
  assert.equal(bd.isBusinessDay(nov(29)), false); // Sun
});

test("addBusinessDays: skips the weekend", () => {
  assert.ok(sameDate(bd.addBusinessDays(nov(23), 3), nov(26))); // Mon + 3 = Thu
  assert.ok(sameDate(bd.addBusinessDays(nov(26), 1), nov(27))); // Thu + 1 = Fri
  assert.ok(sameDate(bd.addBusinessDays(nov(27), 1), nov(30))); // Fri + 1 = Mon
  assert.ok(sameDate(bd.addBusinessDays(nov(28), 1), nov(30))); // Sat + 1 = Mon
});

test("addBusinessDays: zero days returns the same date", () => {
  assert.ok(sameDate(bd.addBusinessDays(nov(25), 0), nov(25)));
});

test("addBusinessDays: crosses a month and a year end", () => {
  assert.ok(sameDate(bd.addBusinessDays(nov(30), 5), new Date(2026, 11, 7))); // Mon 30 Nov + 5 = Mon 7 Dec
  // Thu 31 Dec 2026 + 2 = Mon 4 Jan 2027 (Fri 1 Jan counts: holidays are not tracked by design)
  assert.ok(sameDate(bd.addBusinessDays(new Date(2026, 11, 31), 2), new Date(2027, 0, 4)));
});

test("addBusinessDays: does not change the date passed in", () => {
  const input = nov(23);
  bd.addBusinessDays(input, 3);
  assert.ok(sameDate(input, nov(23)));
});

test("nextBusinessDay: Friday and the weekend all go to Monday", () => {
  assert.ok(sameDate(bd.nextBusinessDay(nov(26)), nov(27))); // Thu -> Fri
  assert.ok(sameDate(bd.nextBusinessDay(nov(27)), nov(30))); // Fri -> Mon
  assert.ok(sameDate(bd.nextBusinessDay(nov(28)), nov(30))); // Sat -> Mon
  assert.ok(sameDate(bd.nextBusinessDay(nov(29)), nov(30))); // Sun -> Mon
});

test("minCompletionDate: submission + 3 business days", () => {
  assert.ok(sameDate(bd.minCompletionDate(nov(23)), nov(26))); // Mon -> Thu
  assert.ok(sameDate(bd.minCompletionDate(nov(26)), new Date(2026, 11, 1))); // Thu -> Tue 1 Dec
  assert.ok(sameDate(bd.minCompletionDate(nov(28)), new Date(2026, 11, 2))); // Sat -> Wed 2 Dec
});

test("setClockHour: keeps the minutes of a decimal hour", () => {
  const d = bd.setClockHour(nov(25), 16.5);
  assert.equal(d.getHours(), 16);
  assert.equal(d.getMinutes(), 30);
  assert.equal(d.getSeconds(), 0);
});

test("computeDropoffDeadline: business day before closing is due the same day at closing", () => {
  const { date, sameDay } = bd.computeDropoffDeadline(nov(25, 10));
  assert.equal(sameDay, true);
  assert.ok(sameDate(date, nov(25)));
  assert.equal(date.getHours(), bd.BUSINESS_HOUR_END);
  assert.equal(date.getMinutes(), 0);
});

test("computeDropoffDeadline: before the counter opens still counts as the same day", () => {
  const { date, sameDay } = bd.computeDropoffDeadline(nov(25, 7));
  assert.equal(sameDay, true);
  assert.ok(sameDate(date, nov(25)));
});

test("computeDropoffDeadline: closing-time boundary (14:59 same day, 15:00 next day)", () => {
  assert.equal(bd.computeDropoffDeadline(nov(25, 14, 59)).sameDay, true);

  const atClose = bd.computeDropoffDeadline(nov(25, 15, 0));
  assert.equal(atClose.sameDay, false);
  assert.ok(sameDate(atClose.date, nov(26)));
});

test("computeDropoffDeadline: Friday after closing moves to Monday", () => {
  const { date, sameDay } = bd.computeDropoffDeadline(nov(27, 16));
  assert.equal(sameDay, false);
  assert.ok(sameDate(date, nov(30)));
  assert.equal(date.getHours(), bd.BUSINESS_HOUR_END);
});

test("computeDropoffDeadline: weekend submission is due Monday even in the morning", () => {
  const { date, sameDay } = bd.computeDropoffDeadline(nov(28, 9));
  assert.equal(sameDay, false);
  assert.ok(sameDate(date, nov(30)));
});

test("computeDropoffDeadline: uses the drop-off place's own closing hour", () => {
  // Place closes at 16:30, so 16:00 is still the same day and the cutoff is 16:30.
  const open = bd.computeDropoffDeadline(nov(25, 16), 16.5);
  assert.equal(open.sameDay, true);
  assert.equal(open.date.getHours(), 16);
  assert.equal(open.date.getMinutes(), 30);

  // Place closes at 12:00, so 13:00 is already the next day.
  const closed = bd.computeDropoffDeadline(nov(25, 13), 12);
  assert.equal(closed.sameDay, false);
  assert.ok(sameDate(closed.date, nov(26)));
  assert.equal(closed.date.getHours(), 12);
});
