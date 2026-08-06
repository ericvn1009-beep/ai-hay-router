export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

export interface RateLimiter {
  checkRpm(keyId: string, rpm: number): Promise<RateLimitResult>;
  addDailyTokens(keyId: string, tokens: number): Promise<number>;
  getDailyTokens(keyId: string): Promise<number>;
}

/** Minimal Redis surface used by the rate limiter. */
export interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  incrby(key: string, increment: number): Promise<number>;
  get(key: string): Promise<string | null>;
}

/** In-process fixed-window RPM limiter (dev / Redis-down fallback). */
export function createMemoryRateLimiter(): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();
  const daily = new Map<string, { tokens: number; day: string }>();

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  return {
    async checkRpm(keyId, rpm) {
      if (rpm <= 0) return { allowed: true, remaining: Infinity, limit: rpm };
      const now = Date.now();
      const windowMs = 60_000;
      const slot = Math.floor(now / windowMs);
      const k = `${keyId}:${slot}`;
      const cur = windows.get(k) ?? { count: 0, resetAt: (slot + 1) * windowMs };
      cur.count += 1;
      windows.set(k, cur);
      const allowed = cur.count <= rpm;
      return { allowed, remaining: Math.max(0, rpm - cur.count), limit: rpm };
    },

    async addDailyTokens(keyId, tokens) {
      const day = today();
      const cur = daily.get(keyId);
      if (!cur || cur.day !== day) {
        daily.set(keyId, { tokens, day });
        return tokens;
      }
      cur.tokens += tokens;
      return cur.tokens;
    },

    async getDailyTokens(keyId) {
      const cur = daily.get(keyId);
      if (!cur || cur.day !== today()) return 0;
      return cur.tokens;
    },
  };
}

export function createRedisRateLimiter(redis: RedisLike): RateLimiter {
  return {
    async checkRpm(keyId, rpm) {
      if (rpm <= 0) return { allowed: true, remaining: Infinity, limit: rpm };
      const slot = Math.floor(Date.now() / 60_000);
      const k = `aihay:rpm:${keyId}:${slot}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, 120);
      return {
        allowed: count <= rpm,
        remaining: Math.max(0, rpm - count),
        limit: rpm,
      };
    },

    async addDailyTokens(keyId, tokens) {
      const day = new Date().toISOString().slice(0, 10);
      const k = `aihay:daily_tokens:${keyId}:${day}`;
      const total = await redis.incrby(k, tokens);
      if (total === tokens) await redis.expire(k, 60 * 60 * 48);
      return total;
    },

    async getDailyTokens(keyId) {
      const day = new Date().toISOString().slice(0, 10);
      const k = `aihay:daily_tokens:${keyId}:${day}`;
      const v = await redis.get(k);
      return v ? Number(v) : 0;
    },
  };
}
