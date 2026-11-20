CREATE SCHEMA IF NOT EXISTS smashkaro_web;

CREATE TABLE IF NOT EXISTS smashkaro_web.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id text NOT NULL,
  recipient_role text NOT NULL,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL,
  enabled_since timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS smashkaro_web.push_deliveries (
  subscription_id uuid NOT NULL REFERENCES smashkaro_web.push_subscriptions(id) ON DELETE CASCADE,
  notification_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  retry_after timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  delivered boolean NOT NULL DEFAULT false,
  PRIMARY KEY (subscription_id, notification_id)
);

CREATE TABLE IF NOT EXISTS smashkaro_web.checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id text NOT NULL,
  idempotency_key text NOT NULL,
  request jsonb NOT NULL,
  booking_id text UNIQUE,
  gateway_order_id text UNIQUE,
  amount integer CHECK (amount > 0),
  gateway_payment_id text UNIQUE,
  UNIQUE (player_id, idempotency_key)
);
