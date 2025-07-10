// This is the definitive version using the official Google YouTube Data API v3.
// It performs a REAL analysis of the video's metadata for warning keywords.
const { google } = require('googleapis');

// Initialize the YouTube API client
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY // This uses the key from your Netlify settings
});

// List of keywords to search for in the video's text content.
const WARNING_KEYWORDS = [
  'flashing', 'lights', 'warning', 'seizure', 
  'epilepsy', 'strobe', 'photosensitive'
];

exports.handler = async function(event, context) {
  // 1. Get the YouTube URL from the request
  let url;
  try {
    const body = JSON.parse(event.body);
    url = body.url;
    if (!url) {
      throw new Error("A YouTube video URL is required.");
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ status: "error", message: error.message })
    };
  }

  // 2. Extract the Video ID from the URL
  let videoId;
  try {
    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    if (!videoIdMatch || !videoIdMatch[1]) {
      throw new Error("Could not extract a valid Video ID from the URL.");
    }
    videoId = videoIdMatch[1];
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ status: "error", message: error.message })};
  }

  // 3. Get REAL Video Metadata using the Official API
  try {
    const response = await youtube.videos.list({
      part: 'snippet,contentDetails',
      id: videoId,
    });

    if (!response.data.items || response.data.items.length === 0) {
      throw new Error("Video not found or is private.");
    }

    const details = response.data.items[0];
    const snippet = details.snippet;
    const contentDetails = details.contentDetails;

    // Combine all text fields for analysis
    const textToAnalyze = [
      snippet.title,
      snippet.description,
      ...(snippet.tags || [])
    ].join(' ').toLowerCase();

    // Perform the REAL keyword analysis
    let warningFound = false;
    for (const keyword of WARNING_KEYWORDS) {
      if (textToAnalyze.includes(keyword)) {
        warningFound = true;
        break;
      }
    }

    // Parse duration from ISO 8601 format (e.g., "PT2M10S")
    const durationRegex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = contentDetails.duration.match(durationRegex);
    const hours = parseInt(matches[1] || 0);
    const minutes = parseInt(matches[2] || 0);
    const seconds = parseInt(matches[3] || 0);
    const durationInSec = (hours * 3600) + (minutes * 60) + seconds;

    // 4. Send a REAL result back to the website based on the analysis
    const finalResult = {
      status: warningFound ? 'unsafe' : 'safe',
      message: warningFound ? 'Caution: Potential risk detected in video text.' : 'No warnings found in video text.',
      details: warningFound ? 'The video\'s title, tags, or description contain keywords often associated with photosensitive triggers.' : 'Our analysis of the video\'s text metadata did not find any common warning keywords.',
      thumbnailUrl: snippet.thumbnails.high.url,
      duration: durationInSec,
      riskSegments: [{
        start: 0,
        end: durationInSec,
        risk: warningFound ? 'high' : 'low' // Reflect the overall risk in the timeline
      }]
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(finalResult)
    };

  } catch (error) {
    console.error("Error fetching from YouTube API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        status: "error",
        message: "Could not retrieve video information from YouTube.",
        details: error.message || "An unknown API error occurred."
      })
    };
  }
};
