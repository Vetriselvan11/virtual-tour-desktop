const { v4: uuidv4 } = require('uuid');

class SceneAnalysisQueueService {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.jobs = new Map();
  }

  createJob(tourId, totalScenes = 0) {
    const jobId = `analysis_job_${uuidv4()}`;
    const job = {
      jobId,
      tourId,
      totalScenes,
      processedScenes: 0,
      currentScene: '',
      status: 'queued',
      stage: 'queued',
      progress: 0,
      results: null,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.jobs.set(jobId, job);
    this._cleanupOldJobs();
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  updateProgress(jobId, processedScenes, currentScene, stage = 'analyzing_scenes') {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'processing';
    job.stage = stage;
    job.processedScenes = processedScenes;
    job.currentScene = currentScene;
    if (job.totalScenes > 0) {
      job.progress = Math.min(100, Math.round((processedScenes / job.totalScenes) * 90));
    }
    job.updatedAt = new Date().toISOString();
  }

  completeJob(jobId, results) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'completed';
    job.stage = 'completed';
    job.progress = 100;
    job.results = results;
    job.updatedAt = new Date().toISOString();
  }

  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.stage = 'failed';
    job.error = error?.message || String(error);
    job.updatedAt = new Date().toISOString();
  }

  _cleanupOldJobs() {
    if (this.jobs.size > 100) {
      const oneHourAgo = Date.now() - 3600000;
      for (const [id, job] of this.jobs.entries()) {
        if (new Date(job.createdAt).getTime() < oneHourAgo) {
          this.jobs.delete(id);
        }
      }
    }
  }
}

module.exports = new SceneAnalysisQueueService(2);
