from flask import Flask, request, jsonify
from feature_engineering import add_features
import joblib
import pandas as pd

app = Flask(__name__)

model = joblib.load("stress_model.pkl")

@app.route("/predict", methods=["POST"])
def predict():

    data = request.json

    features = pd.DataFrame([{
        "sleep_duration_hours": data["sleep_duration_hours"],
        "sleep_efficiency": data["sleep_efficiency"],
        "hrv_rmssd_ms": data["hrv_rmssd_ms"],
        "avg_hr_day_bpm": data["avg_hr_day_bpm"],
        "resting_hr_bpm": data["resting_hr_bpm"],
        "steps": data["steps"],
        "screen_time_min": data["screen_time_min"],
        "workout_minutes": data["workout_minutes"],
        "mindfulness_minutes": data["mindfulness_minutes"]
    }])
    features = add_features(features)

    prediction = model.predict(features)

    return jsonify({
        "stress_score": round(float(prediction[0]), 2)
    })

if __name__ == "__main__":
    app.run(port=8000, debug=True)