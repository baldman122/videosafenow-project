const ytdl = require('ytdl-core');

exports.handler = async function(event, context) {
  // --- 1. Get the YouTube URL from the request ---
  let url;
  try {
    const body = JSON.parse(event.body);
    url = body.url;
    if (!url || !ytdl.validateURL(url)) {
      throw new Error("Invalid or missing YouTube URL.");
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ status: "error", message: error.message })
    };
  }

  // --- 2. Get Video Metadata using ytdl-core ---
  try {
    const videoInfo = await ytdl.getInfo(url);
    const details = videoInfo.videoDetails;

    // --- 3. Simulate Analysis and Send Result ---
    // Full frame-by-frame analysis is extremely complex in a serverless function.
    // For now, we will return a successful response with the video metadata.
    const finalResult = {
      status: 'safe',
      message: 'Video metadata loaded successfully.',
      details: 'Full photosensitive analysis is a feature in development. This video has not been fully analyzed for risk.',
      thumbnailUrl: details.thumbnails[details.thumbnails.length - 1].url, // Get highest quality thumbnail
      duration: parseInt(details.lengthSeconds),
      // Simulate a "low risk" timeline for now
      riskSegments: [{
        start: 0,
        end: parseInt(details.lengthSeconds),
        risk: 'low'
      }]
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalResult)
    };

  } catch (error) {
    console.error("Error fetching video info:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: "Could not analyze video.",
        details: "The video may be private, age-restricted, or otherwise unavailable."
      })
    };
  }
};
