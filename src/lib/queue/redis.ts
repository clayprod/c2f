import IORedis from 'ioredis';

let redisConnection: IORedis | null = null;

export function getRedisConnection() {
  if (redisConnection) {
    return redisConnection;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL is not configured');
  }

  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return redisConnection;
}
