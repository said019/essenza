-- ============================================
-- WalletClub - Mercado Pago card payments
-- ============================================

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS mp_checkout_url TEXT,
    ADD COLUMN IF NOT EXISTS mp_payment_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS mp_payment_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS mp_status_detail VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS provider_synced_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider
    ON orders(payment_provider);

CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id
    ON orders(mp_payment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_external
    ON payments(provider, external_id)
    WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    event_key VARCHAR(255) NOT NULL,
    event_type VARCHAR(100),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT payment_webhook_events_provider_key_unique UNIQUE (provider, event_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_provider_created
    ON payment_webhook_events(provider, created_at DESC);

INSERT INTO system_settings (key, value, description)
VALUES (
    'mercadopago_config',
    '{
        "access_token": "",
        "public_key": "",
        "webhook_secret": "",
        "frontend_url": "",
        "api_url": "",
        "statement_descriptor": "WALLETCLUB"
    }'::jsonb,
    'Configuración base de Mercado Pago para checkout con tarjeta'
)
ON CONFLICT (key) DO NOTHING;
