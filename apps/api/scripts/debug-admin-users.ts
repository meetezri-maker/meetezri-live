
import axios from 'axios';
import { login } from './utils/auth';

const API_URL = 'http://localhost:3001';

async function debug() {
  try {
    const token = await login();
    console.log('Token fetched');

    try {
      await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Success!');
    } catch (error: any) {
      console.error('Error calling /api/admin/users:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      } else {
        console.error(error.message);
      }
    }
  } catch (error) {
    console.error('Auth failed', error);
  }
}

debug();
