
import dotenv from 'dotenv';
import path from 'path';
import Stripe from 'stripe';
import fs from 'fs';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY is missing');
  process.exit(1);
}

const stripe = new Stripe(stripeKey, {
  apiVersion: '2023-10-16',
  typescript: true,
});

const PLANS = [
  {
    key: 'core',
    name: 'MeetEzri Core Plan',
    amount: 2500, // $25.00
    currency: 'usd',
    interval: 'month' as Stripe.Price.Recurring.Interval,
  },
  {
    key: 'pro',
    name: 'MeetEzri Pro Plan',
    amount: 4900, // $59.00
    currency: 'usd',
    interval: 'month' as Stripe.Price.Recurring.Interval,
  }
];

async function seed() {
  console.log('Seeding Stripe Products and Prices...');
  
  const priceIds: Record<string, string> = {};

  for (const plan of PLANS) {
    console.log(`Processing ${plan.name}...`);
    
    // Check if product exists (simple search)
    const products = await stripe.products.search({
      query: `name:'${plan.name}'`,
    });

    let product = products.data[0];

    if (!product) {
      console.log(`Creating product: ${plan.name}`);
      product = await stripe.products.create({
        name: plan.name,
      });
    } else {
      console.log(`Product exists: ${product.id}`);
    }

    // Check for price
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 1,
    });

    let price = prices.data[0];

    if (!price || price.unit_amount !== plan.amount || price.currency !== plan.currency) {
        // Create new price if none exists or amount mismatch
        console.log(`Creating price for ${plan.name}: $${plan.amount/100}`);
        price = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.amount,
            currency: plan.currency,
            recurring: {
                interval: plan.interval,
            },
        });
    } else {
        console.log(`Price exists: ${price.id}`);
    }

    priceIds[plan.key] = price.id;
  }

  console.log('\n--- UPDATE billing.constants.ts WITH THESE IDs ---');
  console.log(JSON.stringify(priceIds, null, 2));

  // Update billing.constants.ts automatically
  const constantsPath = path.join(__dirname, '../src/modules/billing/billing.constants.ts');
  let content = fs.readFileSync(constantsPath, 'utf8');

  // Regex to replace the object
  // Assuming strict format from previous reads
  // We can just replace the whole STRIPE_PRICE_IDS object
  
  const newObject = `export const STRIPE_PRICE_IDS = {
  core: '${priceIds.core}',
  pro: '${priceIds.pro}',
} as const;`;

  // Basic regex replacement for the block
  content = content.replace(/export const STRIPE_PRICE_IDS = \{[\s\S]*?\} as const;/, newObject);

  fs.writeFileSync(constantsPath, content);
  console.log('\nUpdated billing.constants.ts successfully!');
}

seed().catch(console.error);
