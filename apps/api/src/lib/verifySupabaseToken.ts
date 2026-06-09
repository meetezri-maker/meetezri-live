import jwtLib from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase';

/** Validate access token against Supabase Auth (uses Supabase server clock, not local). */
export async function verifySupabaseAccessToken(
  token: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const decoded = jwtLib.decode(token);
  if (!decoded || typeof decoded !== 'object') return null;

  const payload = decoded as { sub?: string };
  if (payload.sub !== data.user.id) return null;

  return payload as Record<string, unknown>;
}
