export default async function handler(req: any, res: any) {
  try {
    // Dynamically import the app to catch initialization errors
    const appModule = await import("../src/app");
    const app = appModule.default;
    
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
