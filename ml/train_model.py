import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

# ==================================
# LOAD DATASET
# ==================================
df = pd.read_csv("../dataset/wearables_health_6mo_daily.csv")

# ==================================
# HANDLE MISSING VALUES
# ==================================
df = df.fillna(df.median(numeric_only=True))
from feature_engineering import add_features

df = add_features(df)

# ==================================
# FEATURES
# ==================================

features = [
    "sleep_duration_hours",
    "sleep_efficiency",
    "hrv_rmssd_ms",
    "avg_hr_day_bpm",
    "resting_hr_bpm",
    "steps",
    "screen_time_min",
    "workout_minutes",
    "mindfulness_minutes",

    # Engineered Features
    "sleep_debt",
    "cardio_stress",
    "digital_fatigue",
    "activity_score",
    "recovery_score",
    "wellness_score"
]

X = df[features]

# ==================================
# TARGET
# ==================================
y = df["custom_stress_score"]

# ==================================
# TRAIN TEST SPLIT
# ==================================
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# ==================================
# RANDOM FOREST MODEL
# ==================================
model = RandomForestRegressor(
    n_estimators=500,
    max_depth=10,
    min_samples_split=10,
    min_samples_leaf=4,
    max_features="sqrt",
    random_state=42,
    n_jobs=-1
)

# ==================================
# TRAIN MODEL
# ==================================
model.fit(X_train, y_train)

# ==================================
# PREDICTIONS
# ==================================
train_predictions = model.predict(X_train)
test_predictions = model.predict(X_test)

# ==================================
# EVALUATION METRICS
# ==================================
mae = mean_absolute_error(y_test, test_predictions)

rmse = np.sqrt(
    mean_squared_error(y_test, test_predictions)
)

train_r2 = r2_score(y_train, train_predictions)
test_r2 = r2_score(y_test, test_predictions)

# ==================================
# WITHIN ±2 POINTS ACCURACY
# ==================================
tolerance = 2

within_tolerance = (
    np.abs(test_predictions - y_test) <= tolerance
)

accuracy_within_2 = (
    within_tolerance.mean() * 100
)

# ==================================
# DISPLAY RESULTS
# ==================================
print("\n====================================")
print("      RANDOM FOREST RESULTS")
print("====================================")

print(f"MAE                       : {mae:.2f}")
print(f"RMSE                      : {rmse:.2f}")
print(f"Train R² Score            : {train_r2:.4f}")
print(f"Test R² Score             : {test_r2:.4f}")
print(f"Within ±2 Points Accuracy : {accuracy_within_2:.2f}%")

# ==================================
# OVERFITTING CHECK
# ==================================
print("\n====================================")
print("         OVERFITTING CHECK")
print("====================================")

difference = train_r2 - test_r2

print(f"Train-Test Gap : {difference:.4f}")

if difference > 0.15:
    print("⚠ Model may be overfitting.")
elif difference > 0.05:
    print("⚠ Slight overfitting detected.")
else:
    print("✅ Train/Test performance is balanced.")

# ==================================
# FEATURE IMPORTANCE
# ==================================
importance = pd.DataFrame({
    "Feature": features,
    "Importance": model.feature_importances_
})

importance = importance.sort_values(
    by="Importance",
    ascending=False
)

print("\n====================================")
print("        FEATURE IMPORTANCE")
print("====================================")
print(importance)

# ==================================
# SAVE MODEL
# ==================================
joblib.dump(model, "stress_model.pkl")

print("\n✅ Model Saved Successfully")
print("📁 File: stress_model.pkl")