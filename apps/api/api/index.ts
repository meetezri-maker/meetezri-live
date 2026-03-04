import { FastifyInstance } from 'fastify';

export default async function handler(req: any, res: any) {
  // Set a hard timeout to prevent Vercel from hanging without response
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("API Request Timeout - 9s limit reached")), 9000);
  });

  try {
    // Log for debugging Vercel logs
    console.log(`[API Handler] ${req.method} ${req.url}`);

    // Dynamically import the app to ensure Vercel bundles dependencies correctly
    // We use 'import' instead of 'require' for better static analysis by Vercel's builder
    const appModule = await Promise.race([
      import("../src/app"),
      timeoutPromise
    ]) as any;
    
    // Cast to any/FastifyInstance to avoid TS errors with the dynamic import type
    const app = appModule.default as unknown as FastifyInstance;
    
    if (!app) {
      throw new Error("Failed to load app module: default export is missing");
    }

    // Delegate to Fastify with timeout race
    await Promise.race([
      app.ready(),
      timeoutPromise
    ]);
    
    app.server.emit("request", req, res);
  } catch (error) {
    console.error("Fastify startup error:", error);
    
    if (!res.headersSent) {
      res.statusCode = error instanceof Error && error.message.includes("Timeout") ? 504 : 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: res.statusCode === 504 ? "Gateway Timeout" : "Internal Server Error", 
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestInfo: {
          method: req.method,
          url: req.url
        }
      }));
    }
  }
}
