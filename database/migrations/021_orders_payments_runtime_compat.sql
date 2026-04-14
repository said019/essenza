-- ============================================
-- Runtime compatibility for orders/payments tables
-- Aligns existing databases with the current checkout + Mercado Pago code
-- ============================================

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS customer_notes TEXT,
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS discount_code_id UUID,
    ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS mp_checkout_url TEXT,
    ADD COLUMN IF NOT EXISTS mp_payment_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS mp_payment_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS mp_status_detail VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS provider_synced_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_orders_payment_provider
    ON orders(payment_provider);

CREATE INDEX IF NOT EXISTS idx_orders_mp_payment_id
    ON orders(mp_payment_id);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS order_id UUID,
    ADD COLUMN IF NOT EXISTS transaction_date TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'payments_order_id_fkey'
    ) THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_order_id_fkey
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_order
    ON payments(order_id);

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
