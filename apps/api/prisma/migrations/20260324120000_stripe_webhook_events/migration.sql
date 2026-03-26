-- Stripe webhook idempotency ledger (cross-instance safe).
-- Run this full script in your SQL editor (not just the table name).

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
    id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing',
    processed_at TIMESTAMPTZ(6),
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT (timezone('utc', now())),
    CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id)
);
