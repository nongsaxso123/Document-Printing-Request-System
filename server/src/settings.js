/**
 * System-wide admin toggles — email notifications to officers, and
 * Requester-facing maintenance mode. Backed by a singleton SystemSetting
 * row (id always 1). See views/admin/settings.ejs and the maintenance-mode
 * gate in app.js. (Office phone and drop-off/pickup places used to live
 * here too; they moved to src/locations.js.)
 */

const prisma = require("./prisma");
const translate = require("./translate");

const SETTINGS_ID = 1;

const DEFAULTS = {
  officerEmailNotificationsEnabled: true,
  maintenanceModeEnabled: false,
  maintenanceMessage: null,
  maintenanceMessageEn: null,
  maintenanceStartsAt: null,
  maintenanceEndsAt: null
};

async function get() {
  const row = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
  return row || { id: SETTINGS_ID, ...DEFAULTS, updatedByAdminEmail: null, updatedAt: null };
}

// Every field below is only added to `data` when the caller actually
// provided it (!== undefined), so an omitted field is left out of `data`
// entirely (Prisma's update() then leaves that column untouched) rather
// than being coerced to null and silently wiping out whatever another
// caller had saved there.
// Whether Requesters are blocked right now: the switch must be on and `now`
// must fall inside the optional [start, end) window. A null start means
// "already closed", a null end means "closed until an Admin reopens it".
function isMaintenanceActive(current, now = new Date()) {
  if (!current.maintenanceModeEnabled) return false;
  if (current.maintenanceStartsAt && now < current.maintenanceStartsAt) return false;
  if (current.maintenanceEndsAt && now >= current.maintenanceEndsAt) return false;
  return true;
}

async function update({ officerEmailNotificationsEnabled, maintenanceModeEnabled, maintenanceMessage, maintenanceMessageEn, maintenanceStartsAt, maintenanceEndsAt }, adminEmail) {
  const data = { updatedByAdminEmail: adminEmail };

  if (officerEmailNotificationsEnabled !== undefined) data.officerEmailNotificationsEnabled = officerEmailNotificationsEnabled;
  if (maintenanceModeEnabled !== undefined) data.maintenanceModeEnabled = maintenanceModeEnabled;
  if (maintenanceStartsAt !== undefined) data.maintenanceStartsAt = maintenanceStartsAt;
  if (maintenanceEndsAt !== undefined) data.maintenanceEndsAt = maintenanceEndsAt;

  if (maintenanceMessage !== undefined) {
    const trimmedMessage = maintenanceMessage ? String(maintenanceMessage).trim() : null;
    const trimmedMessageEn = maintenanceMessageEn ? String(maintenanceMessageEn).trim() : null;

    // The admin can type their own English text; only auto-translate when
    // that field is left blank. Even then, only re-translate when the Thai
    // text actually changed — avoids calling the external translate
    // endpoint on every save and keeps the last good translation if the
    // text is untouched.
    let resolvedMessageEn = trimmedMessageEn;
    if (!resolvedMessageEn && trimmedMessage) {
      const current = await prisma.systemSetting.findUnique({ where: { id: SETTINGS_ID } });
      if (current && current.maintenanceMessage === trimmedMessage && current.maintenanceMessageEn) {
        resolvedMessageEn = current.maintenanceMessageEn;
      } else {
        resolvedMessageEn = await translate.translateToEnglish(trimmedMessage);
      }
    }
    data.maintenanceMessage = trimmedMessage;
    data.maintenanceMessageEn = resolvedMessageEn;
  }

  return prisma.systemSetting.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...DEFAULTS, ...data },
    update: data
  });
}

module.exports = { get, update, isMaintenanceActive };
