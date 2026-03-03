
import { getToken } from './get-token';

const API_URL = 'http://localhost:3001/api';

async function benchmark(name: string, url: string, token: string) {
  const times: number[] = [];
  const iterations = 5;

  console.log(`\nBenchmarking ${name} (${url})...`);

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status !== 200) {
        console.error(`  Error: ${response.status} ${response.statusText}`);
        const text = await response.text();
        console.error(`  Body: ${text.slice(0, 100)}...`);
        return;
      }
      
      // Ensure body is read
      await response.json();

      const end = performance.now();
      const duration = end - start;
      times.push(duration);
      console.log(`  Run ${i + 1}: ${duration.toFixed(2)}ms`);
    } catch (error) {
      console.error(`  Run ${i + 1} failed:`, error);
    }
  }

  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);
  }
}

async function main() {
  try {
    const token = await getToken();
    console.log('Got token');

    await benchmark('Admin Users', `${API_URL}/admin/users?limit=50`, token);
    await benchmark('Wellness Progress', `${API_URL}/wellness/progress`, token);
    await benchmark('Billing Subscriptions', `${API_URL}/billing/admin/subscriptions?limit=50`, token);

  } catch (error) {
    console.error('Benchmark failed:', error);
  }
}

main();
