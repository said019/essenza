import { query, queryOne } from '../config/database.js';

type DbClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
};

export interface LoyaltyConfig {
  points_per_class: number;
  points_per_peso: number;
  points_per_peso_cash: number;
  enabled: boolean;
  welcome_bonus: number;
  birthday_bonus: number;
  referral_bonus: number;
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  points_per_class: 1,
  points_per_peso: 1,
  points_per_peso_cash: 2,
  enabled: true,
  welcome_bonus: 10,
  birthday_bonus: 10,
  referral_bonus: 5,
};

const LOYALTY_KEYS = ['loyalty_config', 'loyalty_settings'] as const;

let hasUsersLoyaltyPointsColumn: boolean | null = null;

const toNonNegativeInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const normalizeConfig = (value: unknown): LoyaltyConfig => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_LOYALTY_CONFIG };
  }

  const raw = value as Record<string, unknown>;

  return {
    points_per_class: toNonNegativeInt(raw.points_per_class, DEFAULT_LOYALTY_CONFIG.points_per_class),
    points_per_peso: toNonNegativeInt(raw.points_per_peso, DEFAULT_LOYALTY_CONFIG.points_per_peso),
    points_per_peso_cash: toNonNegativeInt(raw.points_per_peso_cash, DEFAULT_LOYALTY_CONFIG.points_per_peso_cash),
    enabled:
      raw.enabled === undefined
        ? DEFAULT_LOYALTY_CONFIG.enabled
        : typeof raw.enabled === 'string'
          ? raw.enabled.toLowerCase() === 'true'
          : Boolean(raw.enabled),
    welcome_bonus: toNonNegativeInt(raw.welcome_bonus, DEFAULT_LOYALTY_CONFIG.welcome_bonus),
    birthday_bonus: toNonNegativeInt(raw.birthday_bonus, DEFAULT_LOYALTY_CONFIG.birthday_bonus),
    referral_bonus: toNonNegativeInt(raw.referral_bonus, DEFAULT_LOYALTY_CONFIG.referral_bonus),
  };
};

const parseSettingValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const runQuery = async <T = any>(db: DbClient | null, text: string, params?: unknown[]): Promise<T[]> => {
  if (db) {
    const result = await db.query(text, params);
    return result.rows as T[];
  }
  return query<T>(text, params as any[]);
};

const queryFirst = async <T = any>(db: DbClient | null, text: string, params?: unknown[]): Promise<T | null> => {
  if (db) {
    const result = await db.query(text, params);
    return (result.rows[0] as T) || null;
  }
  return queryOne<T>(text, params as any[]);
};

export async function getLoyaltyConfig(db: DbClient | null = null): Promise<LoyaltyConfig> {
  const setting = await queryFirst<{ key: string; value: unknown }>(
    db,
    `SELECT key, value
     FROM system_settings
     WHERE key = ANY($1::text[])
     ORDER BY CASE WHEN key = 'loyalty_config' THEN 0 ELSE 1 END
     LIMIT 1`,
    [LOYALTY_KEYS]
  );

  const parsed = parseSettingValue(setting?.value);
  return normalizeConfig(parsed);
}

export async function saveLoyaltyConfig(
  incoming: unknown,
  updatedBy: string | undefined,
  db: DbClient | null = null
): Promise<LoyaltyConfig> {
  const config = normalizeConfig(incoming);
  const payload = JSON.stringify(config);

  for (const key of LOYALTY_KEYS) {
    if (db) {
      await db.query(
        `INSERT INTO system_settings (key, value, updated_by, description)
         VALUES ($1, $2, $3, 'Configuración del programa de lealtad')
         ON CONFLICT (key) DO UPDATE
         SET value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3`,
        [key, payload, updatedBy || null]
      );
    } else {
      await runQuery(
        null,
        `INSERT INTO system_settings (key, value, updated_by, description)
         VALUES ($1, $2, $3, 'Configuración del programa de lealtad')
         ON CONFLICT (key) DO UPDATE
         SET value = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3`,
        [key, payload, updatedBy || null]
      );
    }
  }

  return config;
}

export async function getUserPointsBalance(userId: string, db: DbClient | null = null): Promise<number> {
  const result = await queryFirst<{ total_points: number | string }>(
    db,
    `SELECT COALESCE(SUM(points), 0)::int as total_points
     FROM loyalty_points
     WHERE user_id = $1`,
    [userId]
  );

  return Number(result?.total_points || 0);
}

export async function syncUserLoyaltyPointsSnapshot(
  userId: string,
  db: DbClient | null = null
): Promise<void> {
  try {
    if (hasUsersLoyaltyPointsColumn === null) {
      const exists = await queryFirst<{ exists: boolean }>(
        db,
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'users'
             AND column_name = 'loyalty_points'
         ) as exists`
      );
      hasUsersLoyaltyPointsColumn = Boolean(exists?.exists);
    }

    if (!hasUsersLoyaltyPointsColumn) return;

    if (db) {
      await db.query(
        `UPDATE users
         SET loyalty_points = (
           SELECT COALESCE(SUM(points), 0)::int
           FROM loyalty_points
           WHERE user_id = $1
         )
         WHERE id = $1`,
        [userId]
      );
    } else {
      await runQuery(
        null,
        `UPDATE users
         SET loyalty_points = (
           SELECT COALESCE(SUM(points), 0)::int
           FROM loyalty_points
           WHERE user_id = $1
         )
         WHERE id = $1`,
        [userId]
      );
    }
  } catch (error: any) {
    if (error?.code === '42703') {
      hasUsersLoyaltyPointsColumn = false;
      return;
    }
    throw error;
  }
}

export async function ensureUserExists(userId: string, db: DbClient | null = null): Promise<boolean> {
  const user = await queryFirst<{ id: string }>(
    db,
    `SELECT id FROM users WHERE id = $1`,
    [userId]
  );
  return Boolean(user?.id);
}

export function computePaymentPoints(amount: number, pointsPerHundred: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(pointsPerHundred) || pointsPerHundred <= 0) return 0;
  return Math.floor(amount / 100) * Math.floor(pointsPerHundred);
}

const buildPaymentPointsDescription = (paymentId: string): string => `Puntos por pago #${paymentId}`;

export async function awardPaymentLoyaltyPoints(params: {
  db: DbClient;
  userId: string;
  paymentId: string;
  amount: number;
  paymentMethod?: string;
}): Promise<number> {
  const { db, userId, paymentId, amount, paymentMethod } = params;
  const config = await getLoyaltyConfig(db);

  if (!config.enabled) return 0;

  // Cash gets more points per $100
  const rate = paymentMethod === 'cash'
    ? (config.points_per_peso_cash || 2)
    : (config.points_per_peso || 1);

  const pointsToAward = computePaymentPoints(amount, rate);
  if (pointsToAward <= 0) return 0;

  const description = buildPaymentPointsDescription(paymentId);
  const exists = await db.query(
    `SELECT id FROM loyalty_points WHERE user_id = $1 AND description = $2 LIMIT 1`,
    [userId, description]
  );
  if (exists.rowCount > 0) return 0;

  await db.query(
    `INSERT INTO loyalty_points (user_id, points, type, description)
     VALUES ($1, $2, 'bonus', $3)`,
    [userId, pointsToAward, description]
  );

  await syncUserLoyaltyPointsSnapshot(userId, db);
  return pointsToAward;
}
