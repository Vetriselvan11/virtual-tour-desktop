const { v4: uuidv4 } = require('uuid');

class PublishJobService {
  constructor() {
    this.jobs = new Map();
  }

  createJob(tourId, options = {}) {
    const jobId = `pub_job_${uuidv4()}`;
    const job = {
      jobId,
      tourId,
      options,
      status: 'queued',
      stage: 'queued',
      progress: 0,
      errors: [],
      warnings: [],
      result: null,
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

  updateProgress(jobId, stage, progress, meta = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'processing';
    job.stage = stage;
    job.progress = Math.min(100, Math.max(0, progress));
    job.updatedAt = new Date().toISOString();
    Object.assign(job, meta);
  }

  completeJob(jobId, result) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'complete';
    job.stage = 'complete';
    job.progress = 100;
    job.result = result;
    job.updatedAt = new Date().toISOString();
  }

  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.status = 'failed';
    job.stage = 'failed';
    job.errors = Array.isArray(error) ? error : [error?.message || String(error)];
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

module.exports = new PublishJobService();
