
import { getAllSubscriptions } from '../src/modules/billing';

async function main() {
  try {
    console.log('Calling getAllSubscriptions...');
    const result = await getAllSubscriptions(1, 10);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
