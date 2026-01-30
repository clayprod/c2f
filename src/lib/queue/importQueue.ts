import { Queue } from 'bullmq';
import { getRedisConnection } from './redis';

export const importQueueName = 'csv-import';

export function getImportQueue() {
  return new Queue(importQueueName, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
}
