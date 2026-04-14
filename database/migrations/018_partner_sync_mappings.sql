-- ============================================================
-- PARTNER SYNC MAPPINGS + WELLHUB EVENT REPORTING
-- Abril 2026
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS partner_class_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('wellhub', 'totalpass')),
    external_class_id VARCHAR(255),
    external_slot_id VARCHAR(255),
    external_event_id VARCHAR(255),
    external_occurrence_id VARCHAR(255),
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed', 'skipped')),
    sync_error TEXT,
    last_synced_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT partner_class_mappings_unique UNIQUE (class_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_partner_class_mappings_channel
    ON partner_class_mappings(channel);

CREATE INDEX IF NOT EXISTS idx_partner_class_mappings_class
    ON partner_class_mappings(class_id);

DROP TRIGGER IF EXISTS update_partner_class_mappings_updated_at ON partner_class_mappings;
CREATE TRIGGER update_partner_class_mappings_updated_at
    BEFORE UPDATE ON partner_class_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE checkins
    ADD COLUMN IF NOT EXISTS partner_reported_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS partner_report_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS partner_report_error TEXT;

CREATE INDEX IF NOT EXISTS idx_checkins_partner_reported_at
    ON checkins(partner_reported_at);
