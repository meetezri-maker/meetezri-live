import fs from 'fs';
import path from 'path';
import app from '../src/app';

const OUTPUT_FILE = path.join(__dirname, 'routes.json');

async function exportRoutes() {
  const routes: Array<{ method: string; url: string }> = [];

  // Add hook to collect routes
  // We add this hook before ready() so it captures routes as plugins are registered/processed
  app.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) 
      ? routeOptions.method 
      : [routeOptions.method];
    
    methods.forEach(method => {
      routes.push({
        method: method as string,
        url: routeOptions.url
      });
    });
  });

  try {
    console.log('Loading application and extracting routes...');
    
    // Wait for plugins to load
    await app.ready();
    
    // Sort routes: URL then Method
    routes.sort((a, b) => {
      const urlCompare = a.url.localeCompare(b.url);
      if (urlCompare !== 0) return urlCompare;
      return a.method.localeCompare(b.method);
    });

    // Write to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(routes, null, 2));
    
    console.log('\nRegistered Routes:');
    routes.forEach(r => console.log(`${r.method.padEnd(7)} ${r.url}`));
    
    console.log(`\nSuccessfully exported ${routes.length} routes to: ${OUTPUT_FILE}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Failed to export routes:', err);
    process.exit(1);
  }
}

exportRoutes();
