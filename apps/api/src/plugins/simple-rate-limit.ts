
import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface RateLimitOptions {
  max: number;
  timeWindow: number; // in milliseconds
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every minute to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

export default fp(async (fastify: FastifyInstance, opts: RateLimitOptions) => {
  const { max = 100, timeWindow = 60000 } = opts || {};

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0] || '';

    // Stripe retries webhook deliveries; global per-IP throttling here can cause dropped entitlement sync.
    if (path === '/api/billing/webhook') return;

    // Skip if it's an OPTIONS request (CORS preflight)
    if (request.method === 'OPTIONS') return;

    const ip = request.ip;
    const now = Date.now();
    
    let record = rateLimitMap.get(ip);
    
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + timeWindow
      };
      rateLimitMap.set(ip, record);
    }
    
    record.count++;
    
    if (record.count > max) {
      reply.header('X-RateLimit-Limit', max);
      reply.header('X-RateLimit-Remaining', 0);
      reply.header('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
      
      reply.code(429).send({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later.'
      });
      return;
    }

    reply.header('X-RateLimit-Limit', max);
    reply.header('X-RateLimit-Remaining', max - record.count);
    reply.header('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
  });
});
