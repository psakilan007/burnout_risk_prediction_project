import pandas as pd
import numpy as np

df = pd.read_csv("../dataset/wearables_health_6mo_daily.csv")

# -------------------------
# Sleep Score (0-100)
# -------------------------
sleep_score = (
    (df["sleep_duration_hours"] / 8) * 40 +
    df["sleep_efficiency"] * 60
)

sleep_score = sleep_score.clip(0, 100)

# -------------------------
# HRV Score
# Higher HRV = Less Stress
# -------------------------
hrv_score = (
    df["hrv_rmssd_ms"] / 100
) * 100

hrv_score = hrv_score.clip(0, 100)

# -------------------------
# Resting HR Stress
# Higher HR = More Stress
# -------------------------
heart_stress = (
    (df["resting_hr_bpm"] - 50) /
    (100 - 50)
) * 100

heart_stress = heart_stress.clip(0, 100)

# -------------------------
# Screen Time Stress
# -------------------------
screen_stress = (
    df["screen_time_min"] / 600
) * 100

screen_stress = screen_stress.clip(0, 100)

# -------------------------
# Activity Protection
# More activity = less stress
# -------------------------
activity_score = (
    df["steps"] / 12000
) * 100

activity_score = activity_score.clip(0, 100)

# -------------------------
# Mindfulness Protection
# -------------------------
mindfulness_score = (
    df["mindfulness_minutes"] / 30
) * 100

mindfulness_score = mindfulness_score.clip(0, 100)

# -------------------------
# CUSTOM STRESS SCORE
# -------------------------

df["custom_stress_score"] = (
      0.25 * (100 - sleep_score)
    + 0.25 * (100 - hrv_score)
    + 0.20 * heart_stress
    + 0.15 * screen_stress
    + 0.10 * (100 - activity_score)
    + 0.05 * (100 - mindfulness_score)
)

df["custom_stress_score"] = (
    df["custom_stress_score"]
    .clip(0,100)
    .round(2)
)

df.to_csv(
    "../dataset/wearables_health_6mo_daily.csv",
    index=False
)

print("CUSTOM STRESS SCORE CREATED")