import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { getToken } from './get-token';

// Configuration
const DEFAULT_BASE_URL = 'http://localhost:3001';
const ROUTES_FILE = path.join(__dirname, 'routes.json');

// Parse arguments
const args = process.argv.slice(2);
const baseUrl = args.find(a => a.startsWith('--url='))?.split('=')[1] || DEFAULT_BASE_URL;
let token = args.find(a => a.startsWith('--token='))?.split('=')[1];

interface Route {
  method: string;
  url: string;
}

interface Result {
  method: string;
  url: string;
  status: number;
  duration: number; // ms
  size: number; // bytes
}

async function loadRoutes(): Promise<Route[]> {
  if (!fs.existsSync(ROUTES_FILE)) {
    console.error(`Routes file not found: ${ROUTES_FILE}`);
    console.error('Please run "npx ts-node scripts/export-routes.ts" first.');
    process.exit(1);
  }
  const content = fs.readFileSync(ROUTES_FILE, 'utf-8');
  return JSON.parse(content);
}

async function benchmarkRoute(method: string, url: string): Promise<Result> {
  const fullUrl = `${baseUrl}${url}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const start = performance.now();
  try {
    const response = await fetch(fullUrl, {
      method,
      headers
    });
    
    // Read body to complete the request
    const text = await response.text();
    const end = performance.now();

    if (response.status >= 400) {
      console.log(`Error on ${url}: ${text.substring(0, 200)}`);
    }

    return {
      method,
      url,
      status: response.status,
      duration: end - start,
      size: text.length
    };
  } catch (error: any) {
    const end = performance.now();
    return {
      method,
      url,
      status: 0, // 0 indicates network error
      duration: end - start,
      size: 0
    };
  }
}

async function run() {
  console.log(`Starting API Benchmark against: ${baseUrl}`);
  
  if (!token) {
    try {
      console.log('Fetching auth token...');
      token = await getToken();
      console.log('Token fetched successfully.');
    } catch (e) {
      console.error('Failed to fetch token:', e);
      // Fallback to empty token
    }
  }

  if (token) console.log('Authentication token provided.');
  else console.log('No authentication token provided. Many routes may return 401.');

  const allRoutes = await loadRoutes();
  
  // Filter for testable routes:
  // 1. GET requests
  // 2. No dynamic parameters (containing ':')
  // 3. Not HEAD requests
  const testableRoutes = allRoutes.filter(r => 
    r.method === 'GET' && 
    !r.url.includes(':')
  );

  // Add some known static routes that might not be in the list if they are defined in app.ts directly
  const staticRoutes = [
    { method: 'GET', url: '/' },
    { method: 'GET', url: '/health' },
    { method: 'GET', url: '/api/health' }
  ];

  // Merge and deduplicate
  const routesToTest = [...staticRoutes];
  testableRoutes.forEach(tr => {
    if (!routesToTest.find(r => r.url === tr.url && r.method === tr.method)) {
      routesToTest.push(tr);
    }
  });

  console.log(`\nTesting ${routesToTest.length} endpoints...\n`);
  
  // Print Header
  console.log(
    `${'Method'.padEnd(7)} | ${'Status'.padEnd(7)} | ${'Time (ms)'.padEnd(10)} | ${'Size (b)'.padEnd(8)} | ${'URL'}`
  );
  console.log('-'.repeat(80));

  const results: Result[] = [];

  for (const route of routesToTest) {
    // Small delay to not overwhelm the server
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Warm-up run (ignore result)
    await benchmarkRoute(route.method, route.url);
    
    // Actual run
    const result = await benchmarkRoute(route.method, route.url);
    results.push(result);

    const statusColor = result.status >= 200 && result.status < 300 ? '\x1b[32m' : // Green
                        result.status >= 300 && result.status < 400 ? '\x1b[33m' : // Yellow
                        result.status >= 400 && result.status < 500 ? '\x1b[31m' : // Red
                        '\x1b[31m'; // Red for 500 or 0

    const resetColor = '\x1b[0m';
    
    const timeColor = result.duration > 500 ? '\x1b[31m' : // Red if slow
                      result.duration > 200 ? '\x1b[33m' : // Yellow if moderate
                      '\x1b[32m'; // Green if fast

    console.log(
      `${route.method.padEnd(7)} | ${statusColor}${result.status.toString().padEnd(7)}${resetColor} | ${timeColor}${result.duration.toFixed(2).padEnd(10)}${resetColor} | ${result.size.toString().padEnd(8)} | ${route.url}`
    );
  }

  // Summary
  const success = results.filter(r => r.status >= 200 && r.status < 300);
  const avgTime = success.length > 0 
    ? success.reduce((acc, r) => acc + r.duration, 0) / success.length 
    : 0;

  console.log('\n--- Summary ---');
  console.log(`Total Requests: ${results.length}`);
  console.log(`Successful (2xx): ${success.length}`);
  console.log(`Failed (4xx/5xx): ${results.length - success.length}`);
  console.log(`Average Response Time (2xx only): ${avgTime.toFixed(2)} ms`);
}

run().catch(console.error);
