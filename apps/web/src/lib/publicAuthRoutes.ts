/** Routes where the user is signing in — skip background authenticated API polling. */
const PUBLIC_AUTH_PATHS = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/invite-create-password',
  '/auth/activate-account',
  '/admin/login',
  '/admin/credentials',
  '/admin/two-factor-auth',
] as const;

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
