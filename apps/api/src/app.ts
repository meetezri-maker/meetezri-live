import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import cors from '@fastify/cors';
import rawBody from 'fastify-raw-body';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
// import './types/fastify'; // Import type augmentation
import authPlugin from './plugins/auth';
import rateLimit from './plugins/simple-rate-limit';
import { userRoutes } from './modules/users/user.routes';
import { emailRoutes } from './modules/email/email.routes';
import { systemSettingsRoutes } from './modules/system-settings/system-settings.routes';
import { sessionRoutes } from './modules/sessions/sessions.routes';
import { moodRoutes } from './modules/moods/moods.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { journalRoutes } from './modules/journal/journal.routes';
import { billingRoutes } from './modules/billing/billing.routes';
import { wellnessRoutes } from './modules/wellness/wellness.routes';
import { sleepRoutes } from './modules/sleep/sleep.routes';
import { habitsRoutes } from './modules/habits/habits.routes';
import { emergencyContactRoutes } from './modules/users/emergency-contacts.routes';
import { notificationRoutes } from './modules/notifications/notifications.routes';
import { notificationsService } from './modules/notifications/notifications.service';
import { aiAvatarsRoutes } from './modules/ai-avatars/ai-avatars.routes';
import jwkToPem from 'jwk-to-pem';
const jwtLib = require('jsonwebtoken');

dotenv.config();

// Debugging for Vercel Environment
console.log('Starting API...');
const dbUrl = process.env.DATABASE_URL || '';
const dbHost = dbUrl.includes('@') ? dbUrl.split('@')[1] : 'Unknown';
const dbUser = dbUrl.includes('://') ? dbUrl.split('://')[1].split(':')[0] : 'Unknown';

console.log('Environment Debug:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL_HOST: dbHost, 
  DATABASE_USER: dbUser, // Log the user to verify if it's 'postgres' or 'postgres.[ref]'
  DIRECT_URL_SET: !!process.env.DIRECT_URL,
});

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Performance monitoring hooks
app.addHook('onRequest', (request, reply, done) => {
  (request as any).startTime = performance.now();
  done();
});

app.addHook('onResponse', (request, reply, done) => {
  const startTime = (request as any).startTime;
  if (startTime) {
    const duration = performance.now() - startTime;
    if (duration > 500) {
      const color = duration > 2000 ? '\x1b[31m' : '\x1b[33m'; // Red > 2s, Yellow > 500ms
      const reset = '\x1b[0m';
      console.log(
        `${color}[SLOW REQUEST] ${request.method} ${request.url} - ${reply.statusCode} - ${duration.toFixed(2)}ms${reset}`
      );
    }
  }
  done();
});

// Fix for Vercel Serverless: Handle pre-parsed body
app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
  // If the body is already parsed by the environment (e.g. Vercel), use it
  if (req.raw && (req.raw as any).body) {
    done(null, (req.raw as any).body);
  } else {
    // Empty or missing body (e.g. POST with no body) -> treat as {}
    const raw = (body as string) ?? '';
    if (raw.trim() === '') {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(raw);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  }
});

// Register core plugins
app.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

app.register(rateLimit, {
  max: 300, // 300 requests per minute per IP
  timeWindow: 60 * 1000
});

app.register(rawBody, {
  field: 'rawBody',
  global: false,
  encoding: 'utf8',
  runFirst: true,
});

// Check if secret is Base64 (common for Supabase) and decode it if necessary
const rawSecret = process.env.SUPABASE_JWT_SECRET;
let secret: string | Buffer | undefined;
if (rawSecret) {
  // If the secret is Base64 (common for Supabase), decode it; otherwise use as-is.
  if (rawSecret.length > 20 && !rawSecret.includes(' ') && rawSecret.endsWith('=')) {
    try {
      secret = Buffer.from(rawSecret, 'base64');
      console.log('Detected Base64 JWT Secret, decoded to buffer.');
    } catch (e) {
      console.log('Failed to decode JWT Secret as Base64, using as string.');
      secret = rawSecret;
    }
  } else {
    secret = rawSecret;
  }
} else {
  console.error('SUPABASE_JWT_SECRET is missing; HS256 JWT verification is disabled.');
}

// Dynamic secret provider for handling both symmetric (HS256) and asymmetric (ES256/RS256) keys
let cachedJwks: any = null;
let lastJwksFetch = 0;

const getJwks = async (projectUrl: string) => {
  const now = Date.now();
  if (cachedJwks && now - lastJwksFetch < 1000 * 60 * 60) { // 1 hour cache
    return cachedJwks;
  }
  
  try {
    const response = await fetch(`${projectUrl}/auth/v1/.well-known/jwks.json`);
    if (!response.ok) throw new Error('Failed to fetch JWKS');
    const data = await response.json();
    cachedJwks = data;
    lastJwksFetch = now;
    console.log('Fetched JWKS keys:', data.keys?.length);
    return data;
  } catch (err) {
    console.error('Error fetching JWKS:', err);
    return null;
  }
};

const secretProvider = async (reqOrHeader: any, tokenOrPayload: any) => {
  let header;
  
  // Handle Fastify-JWT style (request, token)
  if (reqOrHeader.headers || reqOrHeader.raw) {
      // Manually decode header because fastify-jwt passes only payload by default
      const authHeader = reqOrHeader.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
          const tokenStr = authHeader.substring(7);
          const decoded = jwtLib.decode(tokenStr, { complete: true });
          header = decoded?.header;
      }
      
      if (!header) {
          header = tokenOrPayload?.header;
      }
  } 
  // Handle Fast-JWT style (header, payload)
  else {
      header = reqOrHeader;
  }

  // Debugging logs (optional, remove in production)
  // console.log('Decoding header:', header);

  // If alg is HS256, use the Supabase JWT Secret (symmetric)
  if (header?.alg === 'HS256') {
    if (!secret) {
      throw new Error('SUPABASE_JWT_SECRET is required for HS256 verification');
    }
    return secret;
  }

  // Reject tokens without alg (or other unexpected algs) instead of falling back to a default secret.
  if (!header?.alg) {
    throw new Error('JWT header "alg" is missing; rejecting token');
  }

  // If alg is RS256/ES256/PS256, use JWKS from Supabase (asymmetric)
  const projectUrl = process.env.SUPABASE_URL;
  if (!projectUrl) {
    throw new Error('SUPABASE_URL is missing, cannot fetch JWKS');
  }

  const jwks = await getJwks(projectUrl);
  if (!jwks || !jwks.keys) {
      throw new Error('No JWKS keys found');
  }

  // Find the correct key based on kid (Key ID)
  const key = jwks.keys.find((k: any) => k.kid === header.kid);
  if (!key) {
      throw new Error(`No matching key found for kid: ${header.kid}`);
  }

  // Convert JWK to PEM format
  return jwkToPem(key);
};

// Register JWT with dynamic secret provider
app.register(jwt, {
  secret: secretProvider as any,
  verify: {
      allowedIss: process.env.SUPABASE_URL ? [process.env.SUPABASE_URL + '/auth/v1'] : undefined, // Optional: Verify Issuer
      extractToken: (req) => {
          // Standard Bearer token extraction
          if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
              return req.headers.authorization.split(' ')[1];
          }
          return undefined;
      }
  }
});

// Register plugin to add `verifyJWT` decorator
app.register(authPlugin);

// Register routes
app.register(userRoutes, { prefix: '/api/users' });
app.register(emailRoutes, { prefix: '/api/email' });
app.register(systemSettingsRoutes, { prefix: '/api/system-settings' });
app.register(sessionRoutes, { prefix: '/api/sessions' });
app.register(moodRoutes, { prefix: '/api/moods' });
app.register(adminRoutes, { prefix: '/api/admin' });
app.register(journalRoutes, { prefix: '/api/journal' });
app.register(billingRoutes, { prefix: '/api/billing' });
app.register(wellnessRoutes, { prefix: '/api/wellness' });
app.register(sleepRoutes, { prefix: '/api/sleep' });
app.register(habitsRoutes, { prefix: '/api/habits' });
app.register(emergencyContactRoutes, { prefix: '/api/emergency-contacts' });
app.register(notificationRoutes, { prefix: '/api/notifications' });
app.register(aiAvatarsRoutes, { prefix: '/api/ai-avatars' });

app.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
  const statusCode =
    typeof error?.statusCode === 'number'
      ? error.statusCode
      : typeof error?.status === 'number'
      ? error.status
      : 500;

  const isServerError = statusCode >= 500;
  const message = isServerError ? 'An unexpected error occurred' : (error?.message || 'Request failed');
  const errorName =
    typeof error?.name === 'string'
      ? error.name
      : isServerError
      ? 'Internal Server Error'
      : 'Bad Request';

  if (isServerError) {
    request.log.error({ err: error, requestId: request.id }, 'Unhandled API error');
  }

  reply.code(statusCode).send({
    statusCode,
    error: errorName,
    message,
    requestId: request.id,
  });
});

// Health check routes
app.get('/health', async () => ({ ok: true }));
app.get('/api/health', async () => ({ ok: true }));
app.get('/', async () => ({ message: 'MeetEzri API' }));

// Secured cron: streak reminders (configure CRON_SECRET + Vercel cron hitting this URL).
// Register both paths: some Vercel/serverless setups pass `req.url` with or without the `/api` prefix.
async function streakRemindersCronHandler(request: FastifyRequest, reply: FastifyReply) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return reply.code(503).send({ ok: false, message: 'CRON_SECRET is not configured' });
  }
  const authHeader = request.headers.authorization;
  const bearer =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : undefined;
  const headerSecret = request.headers['x-cron-secret'];
  const token =
    bearer || (typeof headerSecret === 'string' ? headerSecret : undefined);
  if (token !== secret) {
    return reply.code(401).send({ ok: false, message: 'Unauthorized' });
  }
  try {
    const result = await notificationsService.processStreakReminderCronJob();
    return reply.send({ ok: true, ...result });
  } catch (err: unknown) {
    request.log.error(err);
    const message = err instanceof Error ? err.message : 'Cron failed';
    return reply.code(500).send({ ok: false, message });
  }
}

app.get('/api/cron/streak-reminders', streakRemindersCronHandler);
app.get('/cron/streak-reminders', streakRemindersCronHandler);

export default app;

if (require.main === module) {
  const start = async () => {
    try {
      await app.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
      console.log(`Server listening on ${process.env.PORT || 3001}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };

  start();
}
