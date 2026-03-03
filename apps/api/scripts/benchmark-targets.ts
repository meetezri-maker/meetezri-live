
import { performance } from 'perf_hooks';
import { getToken } from './get-token';

const API_URL = 'http://localhost:3001';

const endpoints = [
  '/api/admin/users?limit=20',
  '/api/billing/admin/subscriptions?limit=20',
  '/api/billing/invoices',
  '/api/wellness/progress'
];

async function benchmark() {
  try {
    console.log('Fetching auth token...');
    const token = await getToken();
    console.log('Token fetched');

    for (const url of endpoints) {
      console.log(`\nTesting ${url}...`);
      
      const headers = {
        'Authorization': `Bearer ${token}`
      };

      // Warmup / First run
      const start1 = performance.now();
      try {
        const res1 = await fetch(`${API_URL}${url}`, { headers });
        const end1 = performance.now();
        console.log(`Run 1: ${(end1 - start1).toFixed(2)} ms (Status: ${res1.status})`);
        if (res1.status >= 400) {
            const text = await res1.text();
            console.error(`Error Body: ${text.slice(0, 200)}`);
        }
      } catch (error: any) {
        console.error(`Run 1 Failed: ${error.message}`);
      }

      // Run 2
      const start2 = performance.now();
      try {
        const res2 = await fetch(`${API_URL}${url}`, { headers });
        const end2 = performance.now();
        console.log(`Run 2: ${(end2 - start2).toFixed(2)} ms (Status: ${res2.status})`);
      } catch (error) {
        console.error(`Run 2 Failed`);
      }

      // Run 3
      const start3 = performance.now();
      try {
        const res3 = await fetch(`${API_URL}${url}`, { headers });
        const end3 = performance.now();
        console.log(`Run 3: ${(end3 - start3).toFixed(2)} ms (Status: ${res3.status})`);
      } catch (error) {
        console.error(`Run 3 Failed`);
      }
    }

  } catch (error) {
    console.error('Auth failed', error);
  }
}

benchmark();
