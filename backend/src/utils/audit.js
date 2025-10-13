import { AuditLog } from "../models/audit-log.js"
export const audit = async ({ userId, action, ip, ua, meta }) => {
  try {
    await AuditLog.create({ userId, action, ip, ua, meta })
  } catch {
    /* best effort */
  }
}
