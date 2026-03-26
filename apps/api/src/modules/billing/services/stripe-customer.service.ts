import prisma from '../../../lib/prisma';
import { stripe } from '../../../config/stripe';

export async function getOrCreateStripeCustomer(userId: string, email: string) {
  const profile = await prisma.profiles.findUnique({ where: { id: userId } });

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  await prisma.profiles.update({
    where: { id: userId },
    data: { stripe_customer_id: customer.id },
  });

  return customer.id;
}

