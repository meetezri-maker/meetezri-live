import 'fastify';
import '@fastify/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      sub: string;
      email?: string;
      [key: string]: any;
    }
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; [key: string]: any }
    user: { sub: string; id: string; [key: string]: any }
  }
}
