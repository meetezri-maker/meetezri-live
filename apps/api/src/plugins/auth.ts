import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import prisma from '../lib/prisma';

// Simple in-memory cache for user roles/permissions to reduce DB calls
// Map<userId, { role, permissions, timestamp }>
const userRoleCache = new Map<string, { role: string, permissions: any, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Force allowedAlgorithms to ensure fast-jwt accepts ES256/RS256
      // even if global config isn't propagated correctly to local verifier
      await request.jwtVerify({
        allowedAlgorithms: ['HS256', 'RS256', 'ES256', 'PS256']
      } as any);

      // Fetch user role from database and attach to request.user
      const user = request.user as any;
      if (user && user.sub) {
        // Check cache first
        const cached = userRoleCache.get(user.sub);
        const now = Date.now();

        if (cached && (now - cached.timestamp < CACHE_TTL)) {
          user.appRole = cached.role;
          user.permissions = cached.permissions;
        } else {
          // Fetch from DB if not in cache or expired
          const profile = await prisma.profiles.findUnique({
            where: { id: user.sub },
            select: { role: true, permissions: true }
          });
          
          if (profile) {
            user.appRole = profile.role; // Use appRole to avoid conflict with Supabase role
            user.permissions = profile.permissions;
            
            // Update cache
            userRoleCache.set(user.sub, {
              role: profile.role ?? 'user',
              permissions: profile.permissions,
              timestamp: now
            });
          }
        }
      }
    } catch (err) {
      reply.send(err);
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
