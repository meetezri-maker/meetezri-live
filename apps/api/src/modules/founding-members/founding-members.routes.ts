import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getClientIp } from '../../lib/client-ip';
import {
  foundingMemberSignupBodySchema,
  foundingMemberSignupResponseSchema,
} from './founding-members.schema';
import { registerFoundingMember } from './founding-members.service';

/**
 * The global limiter (300/min/IP) is generous for a public write endpoint, so this
 * adds a tighter per-IP budget on top of it. In-memory, matching the existing
 * `simple-rate-limit` plugin approach — no new dependency.
 */
const SIGNUP_RATE_LIMIT_MAX = 10;
const SIGNUP_RATE_LIMIT_WINDOW_MS = 60 * 1000;

const signupAttempts = new Map<string, { count: number; resetTime: number }>();

function isSignupRateLimited(ip: string, now = Date.now()): boolean {
  const record = signupAttempts.get(ip);

  if (!record || now > record.resetTime) {
    signupAttempts.set(ip, { count: 1, resetTime: now + SIGNUP_RATE_LIMIT_WINDOW_MS });
    return false;
  }

  record.count += 1;
  return record.count > SIGNUP_RATE_LIMIT_MAX;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of signupAttempts.entries()) {
    if (now > value.resetTime) signupAttempts.delete(key);
  }
}, SIGNUP_RATE_LIMIT_WINDOW_MS);
cleanupTimer.unref?.();

/**
 * Public Founding Circle lead capture for the pre-launch landing page.
 *
 * Deliberately write-only: there is no lookup route, so the endpoint cannot be
 * used to test whether an arbitrary address is on the list.
 */
export async function foundingMembersRoutes(app: FastifyInstance) {
  app.post(
    '/',
    {
      // 8KB is far more than a two-field form needs; oversized bodies are rejected outright.
      bodyLimit: 8 * 1024,
      schema: {
        tags: ['Founding members'],
        body: foundingMemberSignupBodySchema,
        response: {
          200: foundingMemberSignupResponseSchema,
          429: z.object({
            statusCode: z.number(),
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const ip = getClientIp(request) || request.ip || 'unknown';

      if (isSignupRateLimited(ip)) {
        return reply.code(429).send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Too many requests. Please try again in a moment.',
        });
      }

      const body = request.body as z.infer<typeof foundingMemberSignupBodySchema>;

      try {
        return await registerFoundingMember(body);
      } catch (error) {
        // Never surface driver/constraint detail to a public caller.
        request.log.error({ err: error }, 'Founding member signup failed');
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'We could not save your place just now. Please try again in a moment.',
        });
      }
    }
  );
}
