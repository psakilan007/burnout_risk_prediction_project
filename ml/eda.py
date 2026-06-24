import pandas as pd

print("EDA STARTED")

df = pd.read_csv("../dataset/wearables_health_6mo_daily.csv")

print("\n========== DATASET SHAPE ==========")
print(df.shape)

print("\n========== COLUMN NAMES ==========")
print(df.columns.tolist())

print("\n========== MISSING VALUES ==========")
print(df.isnull().sum())

print("\n========== DUPLICATE RECORDS ==========")
print(df.duplicated().sum())

print("\n========== FIRST 5 ROWS ==========")
print(df.head())