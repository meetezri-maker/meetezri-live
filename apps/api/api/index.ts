import app from "../src/app";

export default async function handler(req: any, res: any) {
  // Delegate to Fastify
  await app.ready();
  app.server.emit("request", req, res);
}
