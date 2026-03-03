
import { performance } from 'perf_hooks';
import { getToken } from './get-token';

const BASE_URL = 'http://localhost:3001';

async function run() {
  console.log('Fetching token...');
  const token = await getToken();
  console.log('Token fetched.');

  const url = `${BASE_URL}/api/billing/invoices`;
  const headers = {
    'Authorization': `Bearer ${token}`
  };

  console.log(`Testing ${url}...`);

  // First call
  const start1 = performance.now();
  const res1 = await fetch(url, { headers });
  const text1 = await res1.text();
  const end1 = performance.now();
  console.log(`Call 1: ${res1.status} - ${(end1 - start1).toFixed(2)}ms`);

  // Second call
  const start2 = performance.now();
  const res2 = await fetch(url, { headers });
  const text2 = await res2.text();
  const end2 = performance.now();
  console.log(`Call 2: ${res2.status} - ${(end2 - start2).toFixed(2)}ms`);

  if (end2 - start2 < 100) {
    console.log('SUCCESS: Caching is working!');
  } else {
    console.log('FAILURE: Caching is NOT working (or Stripe is slow and cache missed).');
  }
}

run().catch(console.error);
