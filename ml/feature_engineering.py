import pandas as pd

def add_features(df):

    # Sleep Debt
    df["sleep_debt"] = (
        8 - df["sleep_duration_hours"]
    ).clip(lower=0)

    # Cardio Stress
    df["cardio_stress"] = (
        df["avg_hr_day_bpm"]
        - df["resting_hr_bpm"]
    )

    # Digital Fatigue
    df["digital_fatigue"] = (
        df["screen_time_min"]
        / (df["sleep_duration_hours"] + 0.1)
    )

    # Activity Score
    df["activity_score"] = (
        df["steps"] / 1000
        + df["workout_minutes"] / 10
    )

    # Recovery Score
    df["recovery_score"] = (
        df["hrv_rmssd_ms"]
        * df["sleep_efficiency"]
    )

    # Wellness Score
    df["wellness_score"] = (
        df["sleep_duration_hours"] * 5
        + df["sleep_efficiency"] * 20
        + df["hrv_rmssd_ms"] / 5
        - df["screen_time_min"] / 30
    )

    return df