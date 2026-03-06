import { FastifyInstance } from 'fastify';
import { 
  createSubscriptionSchema, 
  createCreditPurchaseSchema, 
  updateSubscriptionSchema,
  subscriptionResponseSchema,
  invoiceResponseSchema,
  adminInvoiceResponseSchema,
  paygTransactionResponseSchema
} from './billing.schema';
import * as billingController from './billing.controller';
import { stripeWebhookHandler } from './billing.webhook';
import { z } from 'zod';

export async function billingRoutes(app: FastifyInstance) {
  app.post(
    '/webhook',
    {
      config: { rawBody: true },
    },
    stripeWebhookHandler
  );

  app.get(
    '/',
    {
      schema: {
        response: {
          200: subscriptionResponseSchema.extend({
              id: z.string().optional(),
              user_id: z.string().optional(),
              created_at: z.date().optional(),
              updated_at: z.date().optional()
          }),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.getSubscriptionHandler
  );

  app.post(
    '/',
    {
      schema: {
        body: createSubscriptionSchema,
        response: {
          200: z.union([
            z.object({ checkoutUrl: z.string() }),
            z.object({ subscription: subscriptionResponseSchema })
          ]),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.createSubscriptionHandler
  );

  app.post(
    '/guest-checkout',
    {
      schema: {
        body: createSubscriptionSchema,
        response: {
          200: z.object({ checkoutUrl: z.string() }),
        },
      },
    },
    billingController.createGuestSubscriptionHandler
  );

  app.post(
    '/credits',
    {
      schema: {
        body: createCreditPurchaseSchema,
        response: {
          200: z.object({ checkoutUrl: z.string() }),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.createCreditPurchaseHandler
  );

  app.post(
    '/sync-credits',
    {
      schema: {
        response: {
          200: z.object({
            added: z.number(),
            transactions: z.number(),
          }),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.syncPaygHandler
  );

  app.post(
    '/portal',
    {
      schema: {
        response: {
          200: z.object({ portalUrl: z.string() }),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.createPortalSessionHandler
  );

  app.patch(
    '/',
    {
      schema: {
        body: updateSubscriptionSchema,
        response: {
          200: subscriptionResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.updateSubscriptionHandler
  );

  app.post(
    '/cancel',
    {
      schema: {
        response: {
          200: z.object({ message: z.string() }),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.cancelSubscriptionHandler
  );

  app.get(
    '/history',
    {
      schema: {
        response: {
          200: z.array(subscriptionResponseSchema),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.getBillingHistoryHandler
  );

  app.get(
    '/invoices',
    {
      schema: {
        response: {
          200: z.array(invoiceResponseSchema),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.getInvoicesHandler
  );

  app.get(
    '/admin/subscriptions',
    {
      schema: {
        response: {
          200: z.array(subscriptionResponseSchema.extend({
            id: z.string().optional(),
            user_id: z.string().optional(),
            created_at: z.date().optional(),
            updated_at: z.date().optional(),
            users: z.object({
              email: z.string().optional(),
              profiles: z.object({
                full_name: z.string().nullable().optional(),
              }).nullable().optional()
            }).optional()
          })),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    billingController.getAllSubscriptionsHandler
  );

  app.get(
    '/admin/invoices',
    {
      schema: {
        response: {
          200: z.array(adminInvoiceResponseSchema),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    billingController.getAllInvoicesHandler
  );

  app.get(
    '/admin/payg-transactions',
    {
      schema: {
        response: {
          200: z.array(paygTransactionResponseSchema),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    billingController.getAllPaygTransactionsHandler
  );

  app.get(
    '/admin/users/:userId/subscription',
    {
      schema: {
        params: z.object({ userId: z.string() }),
        response: {
          200: subscriptionResponseSchema.extend({
              id: z.string().optional(),
              user_id: z.string().optional(),
              created_at: z.date().optional(),
              updated_at: z.date().optional()
          }),
        },
      },
      preHandler: [app.authenticate, app.authorize(['super_admin', 'org_admin'])],
    },
    billingController.getSubscriptionByUserIdHandler
  );

  app.post(
    '/sync',
    {
      schema: {
        response: {
          200: subscriptionResponseSchema.optional().nullable(),
        },
      },
      preHandler: [app.authenticate],
    },
    billingController.syncSubscriptionHandler
  );
}
