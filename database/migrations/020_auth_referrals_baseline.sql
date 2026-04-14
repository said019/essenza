-- Migration: complete auth/referrals baseline for fresh Railway databases
-- Purpose: align existing partially-created databases with current auth routes

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'loyalty_points'
          AND column_name = 'related_reward_id'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_loyalty_related_reward'
    ) THEN
        ALTER TABLE loyalty_points
            ADD CONSTRAINT fk_loyalty_related_reward
            FOREIGN KEY (related_reward_id) REFERENCES rewards(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS referral_codes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    code        VARCHAR(32) NOT NULL UNIQUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

CREATE TABLE IF NOT EXISTS referrals (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id   UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'cancelled')),
    completed_at  TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_referral_pair UNIQUE (referrer_id, referred_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON referrals(status);

DROP TRIGGER IF EXISTS update_referrals_updated_at ON referrals;
CREATE TRIGGER update_referrals_updated_at
    BEFORE UPDATE ON referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
