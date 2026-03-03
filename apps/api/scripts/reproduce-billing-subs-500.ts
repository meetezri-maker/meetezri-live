
import { getToken } from './get-token';

const API_URL = 'http://localhost:3001/api';

async function main() {
  try {
    const token = await getToken();
    console.log('Got token');

    console.log('Fetching subscriptions...');
    const response = await fetch(`${API_URL}/billing/admin/subscriptions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('Status:', response.status);
    if (response.status !== 200) {
      const text = await response.text();
      console.log('Response:', text);
    } else {
      const data = await response.json();
      console.log('Data count:', data.length);
    }
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
  }
}

main();
