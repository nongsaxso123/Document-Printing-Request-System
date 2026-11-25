// Unit tests for src/counters.js (file.md Appendix A numbering scheme).
// Run with: npm test
//
// counters.js talks to the database through src/prisma.js. To keep this a
// unit test (no Docker, no PostgreSQL), a small in-memory fake is put in
// Node's require cache under that path before counters.js is loaded, so
// counters.js receives the fake instead of a real PrismaClient.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const store = new Map(); // "REQ:2026" -> lastValue
const fakePrisma = {
  counter: {
    async upsert({ where, create, update }) {
      const { counterType, year } = where.counterType_year;
      const key = `${counterType}:${year}`;
      const lastValue = store.has(key) ? store.get(key) + update.lastValue.increment : create.lastValue;
      store.set(key, lastValue);
      return { counterType, year, lastValue };
    }
  }
};

const prismaPath = path.join(__dirname, "..", "src", "prisma.js");
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
const counters = require("../src/counters");

const year = new Date().getFullYear();

test.beforeEach(() => store.clear());

test("first request number of the year is 000001", async () => {
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-000001`);
});

test("numbers go up by one with no gaps", async () => {
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-000001`);
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-000002`);
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-000003`);
});

test("REQ and RN counters are independent", async () => {
  await counters.nextReferenceNo();
  await counters.nextReferenceNo();
  assert.equal(await counters.nextRunNumber(), `RN-${year}-000001`);
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-000003`);
});

test("a new year starts again from 000001", async () => {
  store.set(`REQ:${year - 1}`, 812);
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-000001`);
});

test("padding boundary: 999999 keeps 6 digits, 1000000 grows to 7", async () => {
  store.set(`REQ:${year}`, 999998);
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-999999`);
  assert.equal(await counters.nextReferenceNo(), `REQ-${year}-1000000`);
});

test("format is PREFIX-YYYY-NNNNNN", async () => {
  assert.match(await counters.nextReferenceNo(), /^REQ-\d{4}-\d{6}$/);
  assert.match(await counters.nextRunNumber(), /^RN-\d{4}-\d{6}$/);
});
