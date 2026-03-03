import { getAllUsers } from '../src/modules/admin/admin.service';

async function main() {
  try {
    console.log('Fetching users directly via service...');
    const start = performance.now();
    const users = await getAllUsers(1, 20);
    const end = performance.now();
    console.log(`Successfully fetched ${users.length} users in ${(end - start).toFixed(2)}ms`);
    if (users.length > 0) {
      console.log('First user sample:', JSON.stringify(users[0], null, 2));
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    process.exit(1);
  }
}

main();
