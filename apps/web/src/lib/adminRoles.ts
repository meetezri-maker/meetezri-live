export type AdminLoginRole = "super_admin" | "org_admin" | "team_admin";

export function normalizeAdminRole(role?: string | null): string | undefined {
  if (!role) return undefined;
  switch (role) {
    case "super":
      return "super_admin";
    case "org":
      return "org_admin";
    case "team":
      return "team_admin";
    default:
      return role;
  }
}

/** Whether the signed-in user may enter admin with the selected portal role. */
export function canAccessAdminPortal(
  profileRole: string | undefined | null,
  selectedRole: AdminLoginRole,
  authUser?: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null
): boolean {
  const fromProfile = normalizeAdminRole(profileRole);
  if (fromProfile === selectedRole || fromProfile === "super_admin") {
    return true;
  }

  const meta = authUser?.app_metadata ?? {};
  const userMeta = authUser?.user_metadata ?? {};
  const metaRole = normalizeAdminRole(
    (meta.app_role ?? meta.admin_role ?? meta.role ?? userMeta.app_role ?? userMeta.role) as
      | string
      | undefined
  );

  return metaRole === selectedRole || metaRole === "super_admin";
}
