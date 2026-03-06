import { FastifyReply, FastifyRequest } from 'fastify';
import {
  createSubscription,
  cancelSubscription,
  getBillingHistory,
  getSubscription,
  updateSubscription,
  getAllSubscriptions,
  updateSubscriptionById,
  createCreditPurchaseSession,
  createCheckoutSession,
  createPortalSession,
  syncSubscriptionWithStripe,
  getInvoicesForUser,
  getAllInvoices,
  getAllPaygTransactions,
  syncPaygCredits,
  createGuestCheckoutSession,
} from './billing.service';
import { CreateSubscriptionInput, UpdateSubscriptionInput, CreateCreditPurchaseInput } from './billing.schema';

interface UserPayload {
  sub: string;
  email?: string;
  role?: string;
}

export async function getSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const subscription = await getSubscription(user.sub);
  
  if (!subscription) {
    return reply.send({
      id: 'default',
      user_id: user.sub,
      plan_type: 'trial',
      status: 'active',
      start_date: new Date(),
      end_date: null,
      billing_cycle: 'monthly',
      amount: 0,
      next_billing_at: null,
      payment_method: null,
    });
  }
  
  return reply.send(subscription);
}

export async function createSubscriptionHandler(
  request: FastifyRequest<{ Body: CreateSubscriptionInput }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const result = await createCheckoutSession(user.sub, user.email || '', request.body);

  return reply.code(200).send(result);
}

export async function createGuestSubscriptionHandler(
  request: FastifyRequest<{ Body: CreateSubscriptionInput }>,
  reply: FastifyReply
) {
  const result = await createGuestCheckoutSession(request.body);
  return reply.code(200).send(result);
}

export async function createCreditPurchaseHandler(
  request: FastifyRequest<{ Body: CreateCreditPurchaseInput }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const result = await createCreditPurchaseSession(user.sub, user.email || '', request.body);
  return reply.code(200).send(result);
}

export async function syncPaygHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const result = await syncPaygCredits(user.sub);
  return reply.code(200).send(result);
}

export async function createPortalSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const result = await createPortalSession(user.sub);
  return reply.send(result);
}

export async function updateSubscriptionHandler(
  request: FastifyRequest<{ Body: UpdateSubscriptionInput }>,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    const subscription = await updateSubscription(user.sub, request.body);
    return reply.send(subscription);
  } catch (error) {
    return reply.code(404).send({ message: 'Active subscription not found' });
  }
}

export async function cancelSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    await cancelSubscription(user.sub);
    return reply.code(200).send({ message: 'Subscription cancelled' });
  } catch (error) {
    return reply.code(404).send({ message: 'Active subscription not found' });
  }
}

export async function getBillingHistoryHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const history = await getBillingHistory(user.sub);
  return reply.send(history);
}

export async function getInvoicesHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  const invoices = await getInvoicesForUser(user.sub);
  return reply.send(invoices);
}

export async function getAllSubscriptionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const query = request.query as any;
  const page = query.page && !isNaN(parseInt(query.page, 10)) ? parseInt(query.page, 10) : 1;
  const limit = query.limit && !isNaN(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 50;
  
  const subscriptions = await getAllSubscriptions(page, limit);
  return reply.send(subscriptions);
}

export async function getAllInvoicesHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const invoices = await getAllInvoices();
  return reply.send(invoices);
}

export async function getAllPaygTransactionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const transactions = await getAllPaygTransactions();
  return reply.send(transactions);
}

export async function adminUpdateSubscriptionHandler(
  request: FastifyRequest<{ Params: { id: string }, Body: UpdateSubscriptionInput }>,
  reply: FastifyReply
) {
  try {
    const subscription = await updateSubscriptionById(request.params.id, request.body);
    return reply.send(subscription);
  } catch (error) {
    return reply.code(404).send({ message: 'Subscription not found' });
  }
}

export async function getSubscriptionByUserIdHandler(
  request: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply
) {
  const { userId } = request.params;
  const subscription = await getSubscription(userId);
  
  if (!subscription) {
    return reply.send({
      id: 'default',
      user_id: userId,
      plan_type: 'trial',
      status: 'active',
      start_date: new Date(),
      end_date: null,
      billing_cycle: 'monthly',
      amount: 0,
      next_billing_at: null,
      payment_method: null,
    });
  }
  
  return reply.send(subscription);
}

export async function syncSubscriptionHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const user = request.user as UserPayload;
  try {
    const subscription = await syncSubscriptionWithStripe(user.sub);
    return reply.send(subscription);
  } catch (error: any) {
    request.log.error({ error }, 'Failed to sync subscription');
    return reply.code(500).send({ message: 'Failed to sync subscription', error: error.message });
  }
}
