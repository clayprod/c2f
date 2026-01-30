export async function waitForJobCompletion(jobId: string, intervalMs: number = 2000) {
  return new Promise<any>((resolve, reject) => {
    let interval: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const data = await res.json();
        if (!res.ok || !data.job) {
          throw new Error(data.error || 'Erro ao consultar status do job');
        }

        const job = data.job;
        if (job.status === 'completed') {
          if (interval) clearInterval(interval);
          resolve(job);
          return;
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
          if (interval) clearInterval(interval);
          reject(new Error(job.error_summary || 'Job falhou'));
        }
      } catch (error) {
        if (interval) clearInterval(interval);
        reject(error);
      }
    };

    interval = setInterval(poll, intervalMs);
    poll();
  });
}
