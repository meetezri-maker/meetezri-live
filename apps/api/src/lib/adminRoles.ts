const ADMIN_ROLES = ['super_admin', 'org_admin', 'team_admin'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function normalizeAppRole(role?: string | null): string | undefined {
  if (!role) return undefined;

  switch (role) {
    case 'super':
      return 'super_admin';
    case 'org':
      return 'org_admin';
    case 'team':
      return 'team_admin';
    default:
      return role;
  }
}

export function isAdminRole(role?: string | null): role is AdminRole {
  const normalized = normalizeAppRole(role);
  return !!normalized && ADMIN_ROLES.includes(normalized as AdminRole);
}

export function inferAdminRoleFromAuthUser(authUser: {
  is_super_admin?: boolean | null;
  raw_app_meta_data?: Record<string, unknown> | null;
  raw_user_meta_data?: Record<string, unknown> | null;
} | null): AdminRole | undefined {
  if (!authUser) return undefined;
  if (authUser.is_super_admin === true) return 'super_admin';

  const metadataCandidates = [authUser.raw_app_meta_data, authUser.raw_user_meta_data];

  for (const metadata of metadataCandidates) {
    if (!metadata || typeof metadata !== 'object') continue;
    const candidate = normalizeAppRole(
      (metadata.app_role ?? metadata.admin_role ?? metadata.role) as string | undefined
    );
    if (isAdminRole(candidate)) {
      return candidate as AdminRole;
    }
  }

  return undefined;
}
