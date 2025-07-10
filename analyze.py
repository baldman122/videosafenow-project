import json
import os
import re
import cv2
import numpy as np
from pytube import YouTube
from googleapiclient.discovery import build

def handler(event, context):
    """
    Netlify Function handler for video analysis.
    """
    # --- 1. Get the YouTube URL from the request ---
    try:
        if not event.get('body'):
            raise ValueError("Request body is empty.")
        
        body = json.loads(event['body'])
        url = body.get('url')
        
        if not url:
            raise ValueError("No URL provided in the request body.")

    except Exception as e:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"status": "error", "message": f"Invalid request: {str(e)}"})
        }

    # --- 2. Get Video Metadata using YouTube Data API ---
    try:
        # IMPORTANT: Your API Key must be stored as an "Environment variable" in Netlify.
        youtube_api_key = os.environ.get("YOUTUBE_API_KEY")
        if not youtube_api_key:
            raise Exception("Server configuration error: YOUTUBE_API_KEY is not set.")

        video_id_match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11}).*', url)
        if not video_id_match:
            raise ValueError("Invalid YouTube URL format.")
        video_id = video_id_match.group(1)

        youtube = build('youtube', 'v3', developerKey=youtube_api_key)
        video_request = youtube.videos().list(part="snippet,contentDetails", id=video_id)
        video_response = video_request.execute()

        if not video_response.get('items'):
            raise ValueError("Video not found, is private, or has been deleted.")

        video_snippet = video_response['items'][0]['snippet']
        video_details = video_response['items'][0]['contentDetails']
        
        duration_str = video_details['duration']
        duration_parts = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
        hours = int(duration_parts.group(1) or 0)
        minutes = int(duration_parts.group(2) or 0)
        seconds = int(duration_parts.group(3) or 0)
        duration_in_seconds = hours * 3600 + minutes * 60 + seconds
        
        thumbnail_url = video_snippet['thumbnails'].get('high', {}).get('url')

    except Exception as e:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"status": "error", "message": "Could not fetch video details.", "details": str(e)})
        }

    # --- 3. Analyze the Video Stream ---
    try:
        yt = YouTube(url)
        stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').first()
        
        if not stream:
            raise Exception("No suitable video stream found for analysis.")
            
        cap = cv2.VideoCapture(stream.url)
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        if not cap.isOpened() or fps == 0:
            raise Exception("Could not open video stream or determine FPS.")

        luma_values = []
        frame_count = 0
        # Limit analysis to first 5 minutes (300 seconds) for performance
        while frame_count < (fps * 300): 
            ret, frame = cap.read()
            if not ret: break
            gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            luma_values.append(np.mean(gray_frame))
            frame_count += 1
        
        cap.release()
        
        analyzed_duration = min(duration_in_seconds, 300)

        # --- 4. Process Luma Values to Find Flashes ---
        LUMA_CHANGE_THRESHOLD = 40
        flashes_per_second = {}
        for i in range(1, len(luma_values)):
            if abs(luma_values[i] - luma_values[i-1]) > LUMA_CHANGE_THRESHOLD:
                second = int(i / fps)
                flashes_per_second[second] = flashes_per_second.get(second, 0) + 1
        
        # --- 5. Create Risk Segments ---
        risk_segments = []
        current_risk = 'low'
        segment_start_time = 0

        for s in range(analyzed_duration + 1):
            risk_level = 'low'
            if s in flashes_per_second:
                if flashes_per_second[s] > 6: risk_level = 'high'
                elif flashes_per_second[s] > 2: risk_level = 'medium'

            if risk_level != current_risk:
                if s > segment_start_time:
                    risk_segments.append({'start': segment_start_time, 'end': s, 'risk': current_risk})
                current_risk = risk_level
                segment_start_time = s
        
        if segment_start_time < analyzed_duration:
            risk_segments.append({'start': segment_start_time, 'end': analyzed_duration, 'risk': current_risk})

        has_high_risk = any(seg['risk'] == 'high' for seg in risk_segments)
        overall_status = 'unsafe' if has_high_risk else 'safe'
        message = 'Caution: High-risk segments detected.' if has_high_risk else 'This video appears to be safe.'
        details = 'Analysis detected rapid, high-contrast changes.' if has_high_risk else 'No significant patterns of high-risk flashing were found.'
        if analyzed_duration < duration_in_seconds:
            details += f" (Note: Analysis was limited to the first 5 minutes of the video)."

        # --- 6. Send the Final Result ---
        final_result = {
            "status": overall_status, "message": message, "details": details,
            "thumbnailUrl": thumbnail_url, "duration": analyzed_duration, "riskSegments": risk_segments
        }
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(final_result)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"status": "error", "message": "An error occurred during video analysis.", "details": str(e)})
        }
