-- ============================================================
-- PARTNER CHANNELS INTEGRATION (Wellhub + TotalPass)
-- Abril 2026
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Credenciales por plataforma
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_credentials (
    channel VARCHAR(20) PRIMARY KEY CHECK (channel IN ('wellhub', 'totalpass')),
    environment VARCHAR(20) NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    api_base_url TEXT,
    booking_base_url TEXT,
    access_base_url TEXT,
    partner_api_key TEXT,
    place_api_key TEXT,
    api_key TEXT,
    api_secret TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    webhook_secret TEXT,
    gym_id VARCHAR(100),
    webhook_url TEXT,
    extra_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

INSERT INTO platform_credentials (channel)
VALUES ('wellhub'), ('totalpass')
ON CONFLICT (channel) DO NOTHING;

-- ------------------------------------------------------------
-- Cuotas por partner en tipos de clase
-- ------------------------------------------------------------
ALTER TABLE class_types
    ADD COLUMN IF NOT EXISTS totalpass_quota INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS wellhub_quota INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'class_types_totalpass_quota_non_negative'
    ) THEN
        ALTER TABLE class_types
            ADD CONSTRAINT class_types_totalpass_quota_non_negative
            CHECK (totalpass_quota >= 0) NOT VALID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'class_types_wellhub_quota_non_negative'
    ) THEN
        ALTER TABLE class_types
            ADD CONSTRAINT class_types_wellhub_quota_non_negative
            CHECK (wellhub_quota >= 0) NOT VALID;
    END IF;
END $$;

-- ------------------------------------------------------------
-- Usuarios provenientes de partners
-- ------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS wellhub_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS totalpass_token VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'app',
    ADD COLUMN IF NOT EXISTS platform_plan VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wellhub_unique
    ON users(wellhub_id)
    WHERE wellhub_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_totalpass_unique
    ON users(totalpass_token)
    WHERE totalpass_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_source ON users(source);

-- ------------------------------------------------------------
-- Reservas originadas por partners
-- ------------------------------------------------------------
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'app',
    ADD COLUMN IF NOT EXISTS external_ref VARCHAR(255),
    ADD COLUMN IF NOT EXISTS partner_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_channel_external_ref
    ON bookings(channel, external_ref)
    WHERE external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_channel_status
    ON bookings(channel, status);

-- ------------------------------------------------------------
-- Inventario por canal sobre clases existentes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('wellhub', 'totalpass')),
    max_spots INTEGER NOT NULL DEFAULT 0,
    booked_spots INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT channel_inventory_unique UNIQUE (class_id, channel),
    CONSTRAINT channel_inventory_max_non_negative CHECK (max_spots >= 0),
    CONSTRAINT channel_inventory_booked_non_negative CHECK (booked_spots >= 0)
);

CREATE INDEX IF NOT EXISTS idx_channel_inventory_class ON channel_inventory(class_id);
CREATE INDEX IF NOT EXISTS idx_channel_inventory_channel ON channel_inventory(channel);

DROP TRIGGER IF EXISTS update_channel_inventory_updated_at ON channel_inventory;
CREATE TRIGGER update_channel_inventory_updated_at
    BEFORE UPDATE ON channel_inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION ensure_channel_inventory_for_class()
RETURNS TRIGGER AS $$
DECLARE
    quotas RECORD;
BEGIN
    SELECT totalpass_quota, wellhub_quota
    INTO quotas
    FROM class_types
    WHERE id = NEW.class_type_id;

    IF COALESCE(quotas.totalpass_quota, 0) > 0 THEN
        INSERT INTO channel_inventory (class_id, channel, max_spots)
        VALUES (NEW.id, 'totalpass', quotas.totalpass_quota)
        ON CONFLICT (class_id, channel) DO UPDATE
        SET max_spots = EXCLUDED.max_spots,
            updated_at = NOW();
    END IF;

    IF COALESCE(quotas.wellhub_quota, 0) > 0 THEN
        INSERT INTO channel_inventory (class_id, channel, max_spots)
        VALUES (NEW.id, 'wellhub', quotas.wellhub_quota)
        ON CONFLICT (class_id, channel) DO UPDATE
        SET max_spots = EXCLUDED.max_spots,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_channel_inventory ON classes;
CREATE TRIGGER trigger_create_channel_inventory
    AFTER INSERT ON classes
    FOR EACH ROW EXECUTE FUNCTION ensure_channel_inventory_for_class();

CREATE OR REPLACE FUNCTION update_partner_inventory_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.channel IN ('wellhub', 'totalpass') AND NEW.status IN ('confirmed', 'checked_in') THEN
            UPDATE channel_inventory
            SET booked_spots = GREATEST(booked_spots + 1, 0),
                updated_at = NOW()
            WHERE class_id = NEW.class_id
              AND channel = NEW.channel;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.channel IN ('wellhub', 'totalpass') AND OLD.status IN ('confirmed', 'checked_in') THEN
            UPDATE channel_inventory
            SET booked_spots = GREATEST(booked_spots - 1, 0),
                updated_at = NOW()
            WHERE class_id = OLD.class_id
              AND channel = OLD.channel;
        END IF;

        IF NEW.channel IN ('wellhub', 'totalpass') AND NEW.status IN ('confirmed', 'checked_in') THEN
            UPDATE channel_inventory
            SET booked_spots = GREATEST(booked_spots + 1, 0),
                updated_at = NOW()
            WHERE class_id = NEW.class_id
              AND channel = NEW.channel;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.channel IN ('wellhub', 'totalpass') AND OLD.status IN ('confirmed', 'checked_in') THEN
            UPDATE channel_inventory
            SET booked_spots = GREATEST(booked_spots - 1, 0),
                updated_at = NOW()
            WHERE class_id = OLD.class_id
              AND channel = OLD.channel;
        END IF;

        RETURN OLD;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_partner_inventory_count ON bookings;
CREATE TRIGGER trigger_update_partner_inventory_count
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_partner_inventory_count();

-- Backfill de inventario a clases ya creadas
INSERT INTO channel_inventory (class_id, channel, max_spots, booked_spots)
SELECT
    c.id,
    'totalpass',
    ct.totalpass_quota,
    COALESCE((
        SELECT COUNT(*)
        FROM bookings b
        WHERE b.class_id = c.id
          AND b.channel = 'totalpass'
          AND b.status IN ('confirmed', 'checked_in')
    ), 0)
FROM classes c
JOIN class_types ct ON ct.id = c.class_type_id
WHERE ct.totalpass_quota > 0
ON CONFLICT (class_id, channel) DO UPDATE
SET max_spots = EXCLUDED.max_spots,
    booked_spots = EXCLUDED.booked_spots,
    updated_at = NOW();

INSERT INTO channel_inventory (class_id, channel, max_spots, booked_spots)
SELECT
    c.id,
    'wellhub',
    ct.wellhub_quota,
    COALESCE((
        SELECT COUNT(*)
        FROM bookings b
        WHERE b.class_id = c.id
          AND b.channel = 'wellhub'
          AND b.status IN ('confirmed', 'checked_in')
    ), 0)
FROM classes c
JOIN class_types ct ON ct.id = c.class_type_id
WHERE ct.wellhub_quota > 0
ON CONFLICT (class_id, channel) DO UPDATE
SET max_spots = EXCLUDED.max_spots,
    booked_spots = EXCLUDED.booked_spots,
    updated_at = NOW();

-- ------------------------------------------------------------
-- Check-ins de partners para validación y fallback manual
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('app', 'wellhub', 'totalpass')),
    external_ref VARCHAR(255),
    platform_event_id VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled', 'failed')),
    validation_method VARCHAR(30) NOT NULL DEFAULT 'automated' CHECK (validation_method IN ('automated', 'attendance', 'manual_panel', 'manual_reception')),
    validated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    validation_attempts INTEGER NOT NULL DEFAULT 0,
    last_validation_error TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    platform_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_platform_event_unique
    ON checkins(platform_event_id)
    WHERE platform_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_checkins_channel_created
    ON checkins(channel, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_status
    ON checkins(status);

CREATE INDEX IF NOT EXISTS idx_checkins_booking
    ON checkins(booking_id);

CREATE INDEX IF NOT EXISTS idx_checkins_user_channel_date
    ON checkins(user_id, channel, created_at DESC);

DROP TRIGGER IF EXISTS update_checkins_updated_at ON checkins;
CREATE TRIGGER update_checkins_updated_at
    BEFORE UPDATE ON checkins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- Idempotencia de eventos externos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(200) PRIMARY KEY,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('wellhub', 'totalpass')),
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_status INTEGER,
    payload_hash VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_processed_events_date
    ON processed_events(processed_at DESC);
