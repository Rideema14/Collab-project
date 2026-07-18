import os
import uuid

import requests
from dotenv import load_dotenv

load_dotenv()

# Talks to our own server.py (which must be running, e.g. `python server.py`),
# rather than Meeting BaaS directly: Meeting BaaS has no "dial into a LiveKit
# SIP endpoint" feature, so server.py builds the websocket streaming URLs and
# bridges the audio into the LiveKit room agent.py listens on.
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000")
MEETING_URL = "https://meet.google.com/xdf-pmbp-hfa"
ROOM_NAME = f"meeting-{uuid.uuid4().hex[:8]}"

response = requests.post(
    f"{SERVER_URL}/api/bot/join",
    json={
        "meeting_url": MEETING_URL,
        "bot_name": "Meeting Manager",
        "room_name": ROOM_NAME,
    },
)

print("Status Code:", response.status_code)
try:
    print("Response:", response.json())
except ValueError:
    print("Response (non-JSON):", response.text)
response.raise_for_status()
