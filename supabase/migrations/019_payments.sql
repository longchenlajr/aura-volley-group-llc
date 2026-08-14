-- Payment schema: a paid flag on teams (mirrors checked_in) plus a payments
-- table recording online transactions. See docs/plans/payment-data-model.md
-- and docs/plans/payment-implementation-contract.md for the full design.

alter table teams add column paid boolean not null default false;

create table payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references teams(id) on delete cascade,
  status text not null check (status in ('pending', 'completed', 'failed', 'refunded')),
  paypal_order_id text not null,
  paypal_capture_id text,
  entry_fee_cents integer not null,
  convenience_fee_cents integer not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  payer_email text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Supports the webhook's fallback team lookup (custom_id is the primary path;
-- this index backs looking a payment up by PayPal order id when it's missing).
create index payments_paypal_order_id_idx on payments (paypal_order_id);

-- RLS lockdown, matching migration 014: enabled, zero policies. Service role
-- (used by all API routes and the webhook) bypasses RLS; anon gets nothing.
alter table payments enable row level security;
