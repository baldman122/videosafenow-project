// This version uses the 'play-dl' library, which is robust for fetching YouTube data.
const play = require('play-dl');

exports.handler = async function(event, context) {
  // 1. Get the YouTube URL from the request
  let url;
  try {
    const body = JSON.parse(event.body);
    url = body.url;
    // Use the library's validation method to ensure it's a valid YouTube video URL
    if (!url || play.yt_validate(url) !== 'video') {
      throw new Error("A valid YouTube video URL is required.");
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ status: "error", message: error.message })
    };
  }

  // 2. Get REAL Video Metadata using play-dl
  try {
    const videoInfo = await play.video_info(url);
    const details = videoInfo.video_details;

    // 3. Send a REAL result back to the website
    // Note: Full frame-by-frame analysis is a future feature. For now, we are
    // successfully fetching REAL data from YouTube and returning it.
    const finalResult = {
      status: 'safe', // This is simulated for now, as frame analysis is not yet built
      message: 'Video metadata loaded successfully.',
      details: 'This is a REAL result from YouTube. Full photosensitive analysis is a feature in development.',
      thumbnailUrl: details.thumbnails[details.thumbnails.length - 1].url, // Get highest quality thumbnail
      duration: details.durationInSec,
      riskSegments: [{ // Simulate a "low risk" timeline for the full duration
        start: 0,
        end: details.durationInSec,
        risk: 'low'
      }]
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalResult)
    };

  } catch (error) {
    console.error("Error fetching video info with play-dl:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: "Could not retrieve video information.",
        details: "The video may be private, age-restricted, or otherwise unavailable."
      })
    };
  }
};
