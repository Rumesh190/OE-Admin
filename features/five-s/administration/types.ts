export const ADMIN_ROLES = ["Admin","Auditor","Zone Leader","Zone Member","Reviewer"] as const;
export type AdminRole = typeof ADMIN_ROLES[number] | "Viewer";
export type AdminUserStatus = "Active"|"Inactive";

export const PERMISSION_GROUPS = {
  Dashboard:["dashboard.view"],
  Audits:["audits.view","audits.create","audits.execute","audits.complete"],
  Actions:["actions.view","actions.create","actions.assign","actions.work","actions.review","actions.close"],
  Reports:["reports.view","reports.export"],
  "Continual Improvement":["ci.view","ci.create","ci.review","ci.implement","ci.complete"],
  "Red Tag":["red_tag.view","red_tag.create","red_tag.manage","red_tag.print"],
  Administration:["administration.view","administration.manage_users","administration.manage_roles","administration.manage_configuration"],
} as const;

export type PermissionCode = typeof PERMISSION_GROUPS[keyof typeof PERMISSION_GROUPS][number];
export type ZoneResponsibility = "Leader"|"Member"|"Auditor"|"Viewer";
export interface AdminZoneMembership { zone:string; responsibility:ZoneResponsibility }
export interface AdminUser { accessModel?: "v3"; id:string; employeeId:string; name:string; email:string; plant:string; status:AdminUserStatus; roles:AdminRole[]; zoneMemberships:AdminZoneMembership[]; permissions:PermissionCode[]; updatedAt:string }
export type AdminUserInput = Omit<AdminUser,"id"|"updatedAt">;
