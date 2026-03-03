import 'dotenv/config';
import { stripe } from '../src/config/stripe';

async function setupStripe() {
  console.log('Verifying Stripe connection...');
  
  try {
    const account = await stripe.accounts.retrieve();
    console.log(`✅ Connected to Stripe account: ${account.id} (${account.email || 'No email'})`);
  } catch (error) {
    console.error('❌ Failed to connect to Stripe. Please check your STRIPE_SECRET_KEY.');
    console.error(error);
    process.exit(1);
  }

  const plans = [
    { name: 'Core Plan', key: 'core', amount: 2500 }, // $25.00
    { name: 'Pro Plan', key: 'pro', amount: 4900 },     // $59.00
  ];

  const priceIds: Record<string, string> = {};

  console.log('\nChecking products and prices...');

  for (const plan of plans) {
    // Check if product exists
    const products = await stripe.products.search({
      query: `name:'${plan.name}'`,
    });

    let product = products.data[0];
    
    if (!product) {
      console.log(`Creating product: ${plan.name}...`);
      product = await stripe.products.create({
        name: plan.name,
        description: `${plan.name} Subscription`,
      });
    } else {
      console.log(`Found existing product: ${plan.name}`);
    }

    // Check for price
    const prices = await stripe.prices.list({
      product: product.id,
      limit: 1,
      active: true,
    });

    let price = prices.data[0];

    if (!price) {
      console.log(`Creating price for ${plan.name}...`);
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amount,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
    } else {
      console.log(`Found existing price for ${plan.name}`);
    }

    priceIds[plan.key] = price.id;
  }

  console.log('\n✅ Setup Complete! Here are your Price IDs:');
  console.log(JSON.stringify(priceIds, null, 2));
  
  console.log('\n⚠️  Next Steps:');
  console.log('1. Add these Price IDs to your application constants or database.');
  console.log('2. Configure your Webhook Endpoint in the Stripe Dashboard:');
  console.log('   - Go to Developers > Webhooks');
  console.log('   - Add Endpoint: <YOUR_API_URL>/billing/webhook');
  console.log('   - Select events: invoice.payment_succeeded, customer.subscription.updated, customer.subscription.deleted');
  console.log('   - Copy the Signing Secret (whsec_...) to your .env file as STRIPE_WEBHOOK_SECRET');
}

setupStripe();
