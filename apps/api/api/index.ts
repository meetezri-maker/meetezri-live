import { FastifyInstance } from 'fastify';

export default async function handler(req: any, res: any) {
  try {
    // Log for debugging Vercel logs
    console.log(`[API Handler] ${req.method} ${req.url}`);

    // Dynamically import the app to ensure Vercel bundles dependencies correctly
    // We use 'import' instead of 'require' for better static analysis by Vercel's builder
    const appModule = await import("../src/app");
    
    // Cast to any/FastifyInstance to avoid TS errors with the dynamic import type
    const app = appModule.default as unknown as FastifyInstance;
    
    if (!app) {
      throw new Error("Failed to load app module: default export is missing");
    }

    // Delegate to Fastify
    await app.ready();
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("Fastify startup error:", error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      error: "Internal Server Error", 
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }));
  }
}
