// This function will receive the user's request and send it to the real Azure worker.
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // IMPORTANT: You will replace this with your real Azure worker URL later.
  const AZURE_WORKER_URL = process.env.AZURE_WORKER_URL; 

  if (!AZURE_WORKER_URL) {
    return { statusCode: 500, body: JSON.stringify({ message: "Azure worker URL is not configured." })};
  }

  try {
    const body = JSON.parse(event.body);
    const jobId = Math.random().toString(36).substring(2, 15);

    // Send the job to the Azure worker
    await fetch(AZURE_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: body.url, jobId: jobId })
    });

    // Immediately return the Job ID to the user
    return {
      statusCode: 202, // 202 Accepted
      body: JSON.stringify({ jobId: jobId })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ message: "Failed to start analysis job.", details: error.message })};
  }
};
