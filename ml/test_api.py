print("TEST STARTED")
import requests

data = {
    "sleep_duration_hours": 7.5,
    "sleep_efficiency": 0.92,
    "hrv_rmssd_ms": 55,
    "avg_hr_day_bpm": 80,
    "resting_hr_bpm": 65,
    "steps": 9000,
    "screen_time_min": 180,
    "workout_minutes": 40,
    "mindfulness_minutes": 15
}

response = requests.post(
    "http://127.0.0.1:8000/predict",
    json=data
)

print("Status Code:", response.status_code)
print("Response:", response.text)