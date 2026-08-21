/**
 * Atomic per-year REQ-/RN- counters — file.md Appendix A numbering scheme.
 * Prisma's upsert compiles to a single INSERT ... ON CONFLICT DO UPDATE,
 * so this is the atomic "UPDATE ... RETURNING (with upsert for a new year)"
 * the SRS calls for — never "SELECT MAX + 1" in application code.
 */

const prisma = require("./prisma");

async function nextNumber(counterType, prefix) {
  const year = new Date().getFullYear();
  const counter = await prisma.counter.upsert({
    where: { counterType_year: { counterType, year } },
    create: { counterType, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } }
  });
  const sequence = String(counter.lastValue).padStart(6, "0");
  return `${prefix}-${year}-${sequence}`;
}

module.exports = {
  nextReferenceNo: () => nextNumber("REQ", "REQ"),
  nextRunNumber: () => nextNumber("RN", "RN")
};
