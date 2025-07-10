// This function checks the status of an ongoing analysis job.
// In a real application, it would check a database for the job's current progress.
// For now, it simulates the progress.

// A simple in-memory object to simulate a database of jobs
const jobs = {};

exports.handler = async function(event, context) {
  const { id } = event.queryStringParameters;

  // If this is the first time we're seeing this job, initialize it.
  if (!jobs[id]) {
    jobs[id] = {
      startTime: Date.now(),
      status: 'processing',
      progress: 0
    };
  }

  const job = jobs[id];
  const elapsedTime = (Date.now() - job.startTime) / 1000; // in seconds

  // Simulate progress over ~10 seconds
  job.progress = Math.min(Math.floor((elapsedTime / 10) * 100), 100);

  if (job.progress < 100) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: id,
        status: 'processing',
        progress: job.progress
      })
    };
  } else {
    // Once progress is 100, return the final, detailed analysis result.
    // This is where the result from the real Python worker would be returned.
    const finalResult = {
        status: 'unsafe',
        message: 'Caution: High-risk segments detected.',
        details: 'Our analysis detected multiple sequences with rapid, high-contrast changes that may trigger photosensitive epilepsy.',
        thumbnailUrl: `https://placehold.co/1280x720/ef4444/ffffff?text=High+Risk+Video`,
        duration: 247,
        riskSegments: [
            { start: 0, end: 62, risk: 'low' },
            { start: 62, end: 75, risk: 'high' },
            { start: 75, end: 150, risk: 'low' },
            { start: 150, end: 168, risk: 'medium' },
            { start: 168, end: 180, risk: 'high' },
            { start: 180, end: 247, risk: 'low' },
        ]
    };

    // Clean up the job from our simulated database
    delete jobs[id];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: id,
        status: 'complete',
        result: finalResult
      })
    };
  }
};
