import { Queue } from 'bullmq';
import { getRedisConnection } from './redis';

export const jobQueueName = 'transactions-jobs';

export function getJobQueue() {
  return new Queue(jobQueueName, {
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
