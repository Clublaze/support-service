const INCREMENT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

export default class RedisRateLimitStore {
  constructor({ redis, prefix = 'rate-limit:' } = {}) {
    this.redis = redis;
    this.prefix = prefix;
    this.windowMs = 60_000;
  }

  init(options = {}) {
    this.windowMs = options.windowMs || this.windowMs;
  }

  async increment(key) {
    const [totalHits, ttl] = await this.redis.eval(INCREMENT_SCRIPT, 1, `${this.prefix}${key}`, this.windowMs);
    const ttlMs = Number(ttl) > 0 ? Number(ttl) : this.windowMs;
    return { totalHits: Number(totalHits), resetTime: new Date(Date.now() + ttlMs) };
  }

  async decrement(key) {
    await this.redis.decr(`${this.prefix}${key}`);
  }

  async resetKey(key) {
    await this.redis.del(`${this.prefix}${key}`);
  }
}
