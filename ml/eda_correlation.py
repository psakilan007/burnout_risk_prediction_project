import pandas as pd
from feature_engineering import add_features

df = pd.read_csv("../dataset/wearables_health_6mo_daily.csv")

df = df.fillna(df.median(numeric_only=True))

df = add_features(df)

corr = df.corr(numeric_only=True)

print(
    corr["stress_score"]
    .sort_values(ascending=False)
)