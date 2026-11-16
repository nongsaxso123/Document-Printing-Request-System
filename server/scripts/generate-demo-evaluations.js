/**
 * Adds synthetic satisfaction evaluations to COMPLETED requests that have
 * none yet, answering the CURRENT evaluation form (/admin/evaluation-form),
 * so the officer evaluations report has a realistic dataset.
 *
 * Deletes nothing: existing evaluations stay as they are.
 * Answers go through evaluationForm.validateAnswers, the same path a real
 * submit takes, so averageRating / comment / answer snapshots match.
 *
 * Run: node scripts/generate-demo-evaluations.js [--rate=0.3]
 *   --rate: share of completed requests that get an evaluation (default 0.3)
 */

const prisma = require("../src/prisma");
const evaluationForm = require("../src/evaluationForm");

const randomInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v) => Math.min(5, Math.max(1, Math.round(v)));

// Free-text answers, by how the person felt overall.
const COMMENTS = {
  good: [
    "เจ้าหน้าที่บริการดีมาก ยิ้มแย้มแจ่มใส",
    "ได้รับเอกสารตรงเวลา ขอบคุณครับ",
    "ระบบใช้งานง่าย สะดวกมาก",
    "งานพิมพ์คมชัด เรียบร้อยดี",
    "ประทับใจการบริการ รวดเร็วทันใจ",
    "ขอบคุณเจ้าหน้าที่ที่ช่วยตรวจเอกสารให้ก่อนพิมพ์",
    "สะดวกกว่าแบบเดิมมาก ไม่ต้องกรอกกระดาษ",
    "บริการดีเยี่ยม จะใช้บริการอีกแน่นอน",
    "Very convenient, thank you.",
    "Fast and friendly service."
  ],
  ok: [
    "โดยรวมดี แต่ช่วงสอบคิวค่อนข้างนาน",
    "อยากให้มีแจ้งเตือนทางอีเมลเร็วกว่านี้",
    "ควรเพิ่มช่องทางติดต่อสอบถามสถานะ",
    "หน้าจอบนมือถือใช้งานยากนิดหน่อย",
    "อยากให้รับเอกสารได้ช่วงพักเที่ยงด้วย",
    "เอกสารพร้อมช้ากว่าที่นัดเล็กน้อย",
    "The pickup hours are a bit short."
  ],
  bad: [
    "รอนานเกินไป ได้เอกสารช้ากว่ากำหนด",
    "งานพิมพ์บางหน้าไม่ชัด ต้องพิมพ์ใหม่",
    "ติดต่อเจ้าหน้าที่ไม่ได้ในช่วงที่ต้องการ",
    "ขั้นตอนการส่งเอกสารต้นฉบับยุ่งยาก",
    "Some pages were missing, had to come back."
  ]
};

async function main() {
  const rateArg = process.argv.find((a) => a.startsWith("--rate="));
  const rate = Math.min(1, Math.max(0, Number(rateArg ? rateArg.slice(7) : 0.3) || 0.3));

  const sections = await evaluationForm.listForm();
  const questions = sections.flatMap((s) => s.questions);
  if (!questions.length) { console.log("The evaluation form has no questions. Nothing to do."); return; }

  const pool = await prisma.request.findMany({
    where: { status: "COMPLETED", evaluation: null, completedTimestamp: { not: null } },
    select: { requestReferenceNo: true, requesterEmail: true, completedTimestamp: true }
  });
  const chosen = pool.filter(() => Math.random() < rate);
  console.log(`${pool.length} completed requests without an evaluation; adding ${chosen.length} (rate ${rate}).`);

  const now = new Date();
  const CHUNK = 1000;
  let done = 0;
  for (let i = 0; i < chosen.length; i += CHUNK) {
    const batch = chosen.slice(i, i + CHUNK);
    const evals = [];
    const answersByRef = new Map();
    for (const r of batch) {
      // one mood per person, a little better in later years
      const year = r.completedTimestamp.getFullYear();
      const base = 3.7 + Math.min(0.6, Math.max(0, (year - 2007) * 0.03)) + (Math.random() - 0.5) * 1.6;
      const mood = base >= 4.3 ? "good" : base >= 3.3 ? "ok" : "bad";
      const body = {};
      for (const q of questions) {
        const key = "q_" + q.id;
        if (q.type === "rating") body[key] = String(clamp(base + (Math.random() - 0.5) * 1.2));
        else if (q.type === "single" || q.type === "multi") {
          const opts = Array.isArray(q.options) ? q.options : [];
          if (!opts.length) continue;
          if (!q.required && Math.random() < 0.3) continue;
          body[key] = q.type === "single" ? pick(opts).key
            : opts.filter(() => Math.random() < 0.4).map((o) => o.key);
          if (q.type === "multi" && !body[key].length) body[key] = [pick(opts).key];
        } else if (q.required || Math.random() < (mood === "good" ? 0.15 : 0.45)) {
          body[key] = pick(COMMENTS[mood]);
        }
      }
      const result = evaluationForm.validateAnswers(sections, body);
      if (result.errors) { console.warn("skipped", r.requestReferenceNo, JSON.stringify(result.errors)); continue; }
      const submitted = new Date(r.completedTimestamp.getTime() + randomInt(10 * 60, 5 * 24 * 3600) * 1000);
      evals.push({
        requestReferenceNo: r.requestReferenceNo,
        requesterEmail: r.requesterEmail,
        averageRating: result.averageRating,
        comment: result.comment,
        submittedAt: submitted > now ? now : submitted
      });
      answersByRef.set(r.requestReferenceNo, result.answers);
    }
    await prisma.evaluation.createMany({ data: evals, skipDuplicates: true });
    const ids = await prisma.evaluation.findMany({
      where: { requestReferenceNo: { in: evals.map((e) => e.requestReferenceNo) } },
      select: { id: true, requestReferenceNo: true, answers: { select: { id: true }, take: 1 } }
    });
    const answers = ids.filter((e) => !e.answers.length)
      .flatMap((e) => (answersByRef.get(e.requestReferenceNo) || []).map((a) => ({ ...a, evaluationId: e.id })));
    for (let j = 0; j < answers.length; j += 5000) await prisma.evaluationAnswer.createMany({ data: answers.slice(j, j + 5000) });
    done += evals.length;
    console.log(`  ...${done}/${chosen.length}`);
  }
  console.log(`Done. Evaluations now: ${await prisma.evaluation.count()}.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
