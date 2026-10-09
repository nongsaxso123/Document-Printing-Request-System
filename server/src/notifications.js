/**
 * In-app notification feed (bell icon) + the email side of FR-07
 * (status-change emails to the Requester) and the Officer-facing
 * "new request submitted" alert (not in file.md, added alongside FR-07
 * on the same mechanism per the user's request). Every notification here
 * always gets an in-app row; email is best-effort on top (see email.js —
 * it never throws, so a bad/missing SMTP config can't break a status
 * change or a new submission).
 *
 * Text (both languages, in-app and email) comes from src/messages.js. What
 * gets stored per row is `params` — the raw ids/dates/location snapshots a
 * message needs — not pre-rendered text, so a notification renders in
 * whichever language the reader has selected, not just the one active when
 * it fired. `title`/`body` are kept as a Thai snapshot for rows created
 * before `params` existed and for anything that fails to render.
 */

const prisma = require("./prisma");
const email = require("./email");
const auth = require("./auth");
const settings = require("./settings");
const locations = require("./locations");
const messages = require("./messages");

async function createNotification({ recipientEmail, requestReferenceNo, type, params, link }) {
  const rendered = messages.textFor(type, params, "th");
  return prisma.notification.create({
    data: {
      recipientEmail,
      requestReferenceNo: requestReferenceNo || null,
      type,
      title: rendered ? rendered.title : type,
      body: rendered ? rendered.body : "",
      params: params || undefined,
      link: link || null
    }
  });
}

function toClientJSON(n) {
  const bilingual = n.params ? messages.bilingualText(n.type, n.params) : null;
  return {
    id: n.id,
    requestReferenceNo: n.requestReferenceNo,
    type: n.type,
    title: bilingual ? { th: bilingual.th.title, en: bilingual.en.title } : { th: n.title, en: n.title },
    body: bilingual ? { th: bilingual.th.body, en: bilingual.en.body } : { th: n.body, en: n.body },
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString()
  };
}

async function list(recipientEmail, { limit } = {}) {
  const rows = await prisma.notification.findMany({
    where: { recipientEmail },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, parseInt(limit, 10) || 20))
  });
  return rows.map(toClientJSON);
}

async function countUnread(recipientEmail) {
  return prisma.notification.count({ where: { recipientEmail, isRead: false } });
}

// Scoped to recipientEmail on both reads — an officer/requester marking a
// notification read should never be able to touch someone else's row just
// by guessing an id.
async function markRead(id, recipientEmail) {
  const result = await prisma.notification.updateMany({
    where: { id: Number(id), recipientEmail },
    data: { isRead: true }
  });
  return result.count > 0;
}

async function markAllRead(recipientEmail) {
  await prisma.notification.updateMany({
    where: { recipientEmail, isRead: false },
    data: { isRead: true }
  });
}

const REQUESTER_LINK = "/requester/my-requests";

function idLabelOf(request) {
  return request.runNumber ? `${request.runNumber} / ${request.requestReferenceNo}` : request.requestReferenceNo;
}

// Fields every catalog entry in messages.js needs regardless of status —
// see baseDetails() there.
function baseParams(request) {
  return {
    idLabel: idLabelOf(request),
    itemList: request.itemList,
    numberOfCopies: request.numberOfCopies,
    refNo: request.requestReferenceNo
  };
}

// The extra, status-specific fields messages.js's catalog needs — dates as
// ISO strings and location as a plain snapshot object, never a Date or a
// live Prisma row, since this becomes Notification.params (a JSON column).
async function buildParams(request, statusKey, extra) {
  const base = baseParams(request);
  switch (statusKey) {
    case "submitted": {
      const dropoffLocation = request.dropoffLocationSnapshot
        || (await locations.getDefault("dropoff").then((l) => l && locations.snapshotOf(l)));
      return { ...base, dropoffLocation, deadline: request.originalDocDeadline.toISOString() };
    }
    case "approved":
      return {
        ...base,
        receivedAt: request.originalDocReceivedTimestamp.toISOString(),
        claimCode: extra.claimCode,
        confirmedDate: new Date(extra.confirmedDate).toISOString()
      };
    case "rejected":
      return { ...base, reason: extra.reason };
    case "ready": {
      const pickupLocation = request.pickupLocationSnapshot
        || (await locations.getDefault("pickup").then((l) => l && locations.snapshotOf(l)));
      return {
        ...base,
        pickupLocation,
        pickupAvailableFrom: request.pickupAvailableFrom ? request.pickupAvailableFrom.toISOString() : null,
        claimCode: request.claimCode
      };
    }
    case "completed":
      return { ...base, completedAt: request.completedTimestamp.toISOString() };
    default:
      return null;
  }
}

async function notifyRequesterStatusChange(request, statusKey, extra) {
  const params = await buildParams(request, statusKey, extra || {});
  if (!params) return;

  await createNotification({
    recipientEmail: request.requesterEmail,
    requestReferenceNo: request.requestReferenceNo,
    type: statusKey,
    params,
    link: REQUESTER_LINK
  });

  const mail = messages.emailFor(statusKey, params);
  if (mail) {
    await email.sendMail({ to: request.requesterEmail, subject: mail.subject, html: mail.html, text: mail.text });
  }
}

// Not in file.md (FR-07 only covers Requester emails) — added on the same
// mechanism per the user's explicit request: every Officer gets both an
// in-app notification and an email for every new submission.
async function notifyOfficersNewRequest(request) {
  const officers = await auth.officers.list();
  if (officers.length === 0) return;

  // Admin-toggleable from "จัดการระบบ" — in-app notifications below always
  // fire regardless; this only gates the email side.
  const { officerEmailNotificationsEnabled } = await settings.get();

  const params = { ...baseParams(request), requesterName: request.requesterName };
  const link = "/officer/queue";

  await Promise.all(officers.map(async (officer) => {
    await createNotification({
      recipientEmail: officer.email,
      requestReferenceNo: request.requestReferenceNo,
      type: "new_request",
      params,
      link
    });

    if (!officerEmailNotificationsEnabled) return;

    const mail = messages.emailFor("new_request", params);
    await email.sendMail({ to: officer.email, subject: mail.subject, html: mail.html, text: mail.text });
  }));
}

// Requester withdrew a request that was still sitting in the Officer queue
// (see requests.js cancel()) — lets Officers stop reviewing/preparing
// something that's no longer coming, same delivery mechanism as
// notifyOfficersNewRequest above.
async function notifyOfficersCancelled(request) {
  const officers = await auth.officers.list();
  if (officers.length === 0) return;

  const { officerEmailNotificationsEnabled } = await settings.get();

  const params = { ...baseParams(request), requesterName: request.requesterName };
  const link = "/officer/queue";

  await Promise.all(officers.map(async (officer) => {
    await createNotification({
      recipientEmail: officer.email,
      requestReferenceNo: request.requestReferenceNo,
      type: "cancelled",
      params,
      link
    });

    if (!officerEmailNotificationsEnabled) return;

    const mail = messages.emailFor("cancelled", params);
    await email.sendMail({ to: officer.email, subject: mail.subject, html: mail.html, text: mail.text });
  }));
}

// D — location relocation notices (src/requests.js notifyLocationChange,
// called from the admin edit/archive flow in routes/api.js). Unlike
// notifyRequesterStatusChange, this isn't keyed by the request's own
// status — the type is purpose-specific (dropoff_moved/pickup_moved) since
// the wording and the date/claim-code shown alongside differ.
async function notifyLocationMoved(request, purpose, oldLocation, newLocation) {
  const base = baseParams(request);
  const type = purpose === "dropoff" ? "dropoff_moved" : "pickup_moved";
  const params = purpose === "dropoff"
    ? { ...base, oldLocation, newLocation, deadline: request.originalDocDeadline.toISOString() }
    : {
      ...base, oldLocation, newLocation, claimCode: request.claimCode,
      pickupAvailableFrom: request.pickupAvailableFrom ? request.pickupAvailableFrom.toISOString() : null
    };

  await createNotification({
    recipientEmail: request.requesterEmail,
    requestReferenceNo: request.requestReferenceNo,
    type,
    params,
    link: REQUESTER_LINK
  });

  const mail = messages.emailFor(type, params);
  if (mail) {
    await email.sendMail({ to: request.requesterEmail, subject: mail.subject, html: mail.html, text: mail.text });
  }
}

module.exports = {
  list, countUnread, markRead, markAllRead,
  notifyRequesterStatusChange, notifyOfficersNewRequest, notifyOfficersCancelled,
  notifyLocationMoved
};
