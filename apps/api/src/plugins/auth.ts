import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

// Simple in-memory cache for user roles/permissions to reduce DB calls
// Map<userId, { role, permissions, onboardingCompleted, timestamp }>
const userRoleCache = new Map<
  string,
  {
    role: string;
    permissions: any;
    onboardingCompleted: boolean;
    signupType: 'trial' | 'plan' | null;
    timestamp: number;
  }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      request.log.info(
        {
          url: request.url,
          hasAuthHeader:
            typeof request.headers.authorization === 'string' &&
            request.headers.authorization.startsWith('Bearer '),
        },
        'Auth middleware start'
      );

      // Restrict accepted algorithms based on available verification material.
      // If HS256 secret isn't configured, do not accept HS256 tokens.
      const allowedAlgorithms: string[] = ['RS256', 'ES256', 'PS256'];
      if (process.env.SUPABASE_JWT_SECRET) {
        allowedAlgorithms.unshift('HS256');
      }

      const tokenAuth = await request.jwtVerify({
        allowedAlgorithms,
      } as any);
      request.log.info(
        {
          url: request.url,
          tokenVerified: !!tokenAuth,
        },
        'JWT verification succeeded'
      );

      // Fetch profile data and attach to request.user
      const user = request.user as any;
      if (user && user.sub) {
        // Check cache first
        const cached = userRoleCache.get(user.sub);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
          user.appRole = cached.role;
          user.permissions = cached.permissions;
          user.onboarding_completed = cached.onboardingCompleted;

          const path = request.url.split('?')[0] || '';
          const APP_API_PREFIXES = [
            '/api/users/credits',
            '/api/sessions',
            '/api/moods',
            '/api/journal',
            '/api/wellness',
            '/api/sleep',
            '/api/habits',
            '/api/notifications',
            '/api/ai-avatars',
            '/api/emergency-contacts',
          ];
          const isOnboardingApi = path.startsWith('/api/users/onboarding');
          const isAppApi = APP_API_PREFIXES.some((p) => path.startsWith(p));
          const isBillingApi = path.startsWith('/api/billing');

          // Plan buyers must not initiate billing while onboarding is incomplete.
          if (isBillingApi && !cached.onboardingCompleted && cached.signupType === 'plan') {
            reply.code(403).send({
              statusCode: 403,
              error: 'Forbidden',
              message: 'Billing is not allowed during onboarding for plan buyers.',
            });
            return;
          }

          if (isOnboardingApi && cached.onboardingCompleted) {
            reply.code(403).send({
              statusCode: 403,
              error: 'Forbidden',
              message: 'Onboarding is already completed for this account.',
            });
            return;
          }

          if (
            isAppApi &&
            !cached.onboardingCompleted &&
            cached.signupType !== 'trial'
          ) {
            reply.code(403).send({
              statusCode: 403,
              error: 'Forbidden',
              message:
                'Onboarding is incomplete. Please complete onboarding before using the app.',
            });
            return;
          }
        } else {
          // Fetch from DB if not in cache or expired
          // Important: keep login stable even if the DB migration isn't applied yet.
          // If `onboarding_completed` column doesn't exist, Prisma will throw.
          // We catch it and fall back to legacy inference.
          let profile: any;
          try {
            profile = await prisma.profiles.findUnique({
              where: { id: user.sub },
              select: {
                role: true,
                permissions: true,
                full_name: true,
                selected_goals: true,
                emergency_contact_relationship: true,
                notification_preferences: true,
                timezone: true,
                signup_type: true,
              } as any,
            });
          } catch (e: any) {
            request.log.error(
              { err: e, userId: user.sub },
              'Failed selecting onboarding_completed from profiles; falling back'
            );
            profile = await prisma.profiles.findUnique({
              where: { id: user.sub },
              select: {
                role: true,
                permissions: true,
                full_name: true,
                selected_goals: true,
                emergency_contact_relationship: true,
                notification_preferences: true,
                timezone: true,
              },
            });
          }
          
          if (profile) {
            user.appRole = profile.role; // Use appRole to avoid conflict with Supabase role
            user.permissions = profile.permissions;

            let signupTypeResolved: 'trial' | 'plan' | null = null;

            const profileSignupType = (profile as any)?.signup_type;
            if (profileSignupType === 'trial' || profileSignupType === 'plan') {
              signupTypeResolved = profileSignupType;
            }

            // Fallback for cases where the DB column isn't available yet.
            if (!signupTypeResolved) {
              try {
                const authUser = await prisma.users.findUnique({
                  where: { id: user.sub },
                  select: { raw_user_meta_data: true },
                });
                const rawMeta: any = authUser?.raw_user_meta_data as any;
                const raw = rawMeta?.signup_type ?? rawMeta?.signupType ?? rawMeta?.signup;
                if (raw === 'trial' || raw === 'plan') {
                  signupTypeResolved = raw;
                }
              } catch {
                // ignore
              }
            }

            // Resolve onboarding completion deterministically.
            // Trial completion == "required trial profile setup is done".
            const onboardingCompletedResolved = (() => {
              if ((profile as any).onboarding_completed === true) return true;

              // If onboarding_completed is explicitly false AND this is NOT a trial user,
              // treat it as authoritative (paid flow).
              if ((profile as any).onboarding_completed === false && signupTypeResolved !== 'trial') {
                return false;
              }

              const fullNameOk =
                typeof profile.full_name === 'string' &&
                profile.full_name.trim().length > 1;

              const emergencyRelationshipOk =
                typeof profile.emergency_contact_relationship === 'string' &&
                profile.emergency_contact_relationship.trim().length > 0;

              const timezoneOk =
                typeof (profile as any).timezone === 'string' &&
                (profile as any).timezone.trim().length > 0;

              const roleOk =
                typeof profile.role === 'string' && profile.role.length > 0;

              // Trial: fullName + timezone + emergency contact + role.
              if (signupTypeResolved === 'trial') {
                return fullNameOk && timezoneOk && emergencyRelationshipOk && roleOk;
              }

              // Plan: stricter paid onboarding wizard criteria.
              const goalsOk =
                Array.isArray(profile.selected_goals) &&
                profile.selected_goals.length > 0;

              const permissionsOk =
                !!profile.permissions &&
                typeof profile.permissions === 'object' &&
                Object.keys(profile.permissions as any).length > 0;

              const notificationPrefsOk =
                !!profile.notification_preferences &&
                typeof profile.notification_preferences === 'object' &&
                Object.keys(profile.notification_preferences as any).length > 0;

              return (
                fullNameOk &&
                goalsOk &&
                emergencyRelationshipOk &&
                permissionsOk &&
                notificationPrefsOk &&
                roleOk
              );
            })();

            user.onboarding_completed = onboardingCompletedResolved;
            
            // Update cache
            userRoleCache.set(user.sub, {
              role: profile.role ?? 'user',
              permissions: profile.permissions,
              onboardingCompleted: onboardingCompletedResolved,
              signupType: signupTypeResolved,
              timestamp: now
            });

            // Backend route guard: deny app API usage until onboarding is complete
            const path = request.url.split('?')[0] || '';

            const APP_API_PREFIXES = [
              '/api/users/credits',
              '/api/sessions',
              '/api/moods',
              '/api/journal',
              '/api/wellness',
              '/api/sleep',
              '/api/habits',
              '/api/notifications',
              '/api/ai-avatars',
              '/api/emergency-contacts',
            ];

            const isOnboardingApi = path.startsWith('/api/users/onboarding');
            const isAppApi = APP_API_PREFIXES.some((p) => path.startsWith(p));

            const isBillingApi = path.startsWith('/api/billing');

            if (isBillingApi && !onboardingCompletedResolved && signupTypeResolved === 'plan') {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Billing is not allowed during onboarding for plan buyers.',
              });
              return;
            }

            if (isOnboardingApi && onboardingCompletedResolved) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Onboarding is already completed for this account.',
              });
              return;
            }

            if (
              isAppApi &&
              !onboardingCompletedResolved &&
              signupTypeResolved !== 'trial'
            ) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message: 'Onboarding is incomplete. Please complete onboarding before using the app.',
              });
              return;
            }
          } else {
            // Profile missing -> treat onboarding as incomplete and block app API usage.
            const path = request.url.split('?')[0] || '';
            const APP_API_PREFIXES = [
              '/api/users/credits',
              '/api/sessions',
              '/api/moods',
              '/api/journal',
              '/api/wellness',
              '/api/sleep',
              '/api/habits',
              '/api/notifications',
              '/api/ai-avatars',
              '/api/emergency-contacts',
            ];
            const isOnboardingApi = path.startsWith('/api/users/onboarding');
            const isAppApi = APP_API_PREFIXES.some((p) => path.startsWith(p));

            user.onboarding_completed = false;

            if (isOnboardingApi) {
              // allow onboarding to proceed to completion
              return;
            }

            if (isAppApi) {
              reply.code(403).send({
                statusCode: 403,
                error: 'Forbidden',
                message:
                  'Onboarding is incomplete. Please complete onboarding before using the app.',
              });
              return;
            }
          }
        }
      }
    } catch (err) {
      request.log.warn(
        {
          err,
          url: request.url,
          hasAuthHeader:
            typeof request.headers.authorization === 'string' &&
            request.headers.authorization.startsWith('Bearer '),
        },
        'Authentication failed in auth plugin'
      );
      reply.code(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Authentication failed'
      });
    }
  });

  fastify.decorate('authorize', (allowedRoles: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as any;
      
      // If no user or no appRole, deny
      if (!user || !user.appRole) {
        reply.code(403).send({ 
          statusCode: 403,
          error: 'Forbidden',
          message: 'Access denied: No role assigned' 
        });
        return;
      }

      // Check if user has one of the allowed roles
      if (!allowedRoles.includes(user.appRole)) {
        reply.code(403).send({ 
          statusCode: 403,
          error: 'Forbidden',
          message: `Access denied: Requires one of [${allowedRoles.join(', ')}] role` 
        });
        return;
      }
    };
  });
});

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: any;
    authorize: (allowedRoles: string[]) => any;
  }
}
