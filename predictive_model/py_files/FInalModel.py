#!/usr/bin/env python3
"""
Final Model: Shark Behavior Prediction Pipeline
Loads preprocessed data and runs HMM behavioral state prediction.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from hmmlearn import hmm
import warnings
import os
warnings.filterwarnings('ignore')


def load_preprocessed_data(filename="preprocessed_shark_pace_data.csv"):
    """Load preprocessed shark and PACE data."""
    if not os.path.exists(filename):
        print(f"Error: Preprocessed data file '{filename}' not found!")
        print("Please run 'python preprocess_data.py' first to generate the data.")
        return None
    
    print(f"Loading preprocessed data from {filename}...")
    df = pd.read_csv(filename)
    df["datetime"] = pd.to_datetime(df["datetime"])
    df["pace_date"] = pd.to_datetime(df["pace_date"])
    df["original_datetime"] = pd.to_datetime(df["original_datetime"])
    
    print(f"Loaded {len(df)} observations for {df['shark_id'].nunique()} sharks")
    print(f"Date range: {df['datetime'].min().date()} to {df['datetime'].max().date()}")
    
    return df



def train_hmm(df):
    """Train a 2-state HMM and assign behavioral states."""
    print("Training 2-state HMM model...")
    features = ["step_length", "turning_angle", "chlor_a", "carbon_phyto", "poc", "water_depth", "eddy_speed", "sst"]
    X = df[features].fillna(df[features].median()).values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = hmm.GaussianHMM(n_components=2, covariance_type="diag", n_iter=200, random_state=42)
    model.fit(X_scaled)
    states = model.predict(X_scaled)
    df["predicted_state"] = states

    # Label states based on average speed and environmental characteristics
    state_stats = df.groupby("predicted_state").agg({
        "speed_km_day": "mean",
        "step_length": "mean",
        "chlor_a": "mean",
        "carbon_phyto": "mean"
    })
    
    print("\nState characteristics:")
    for state in [0, 1]:
        stats = state_stats.loc[state]
        print(f"State {state}: Speed={stats['speed_km_day']:.1f} km/day, "
              f"Chlor-a={stats['chlor_a']:.3f}, Carbon={stats['carbon_phyto']:.1f}")
    
    # Assign behavior labels: high-productivity areas = foraging, low = migrating
    high_productivity_state = state_stats["chlor_a"].idxmax()
    behavior_map = {
        high_productivity_state: "Foraging",
        1 - high_productivity_state: "Migrating"
    }
    
    df["behavior"] = df["predicted_state"].map(behavior_map)
    
    # Print behavior distribution
    behavior_counts = df["behavior"].value_counts()
    print(f"\nBehavior Distribution:")
    for behavior, count in behavior_counts.items():
        percentage = (count / len(df)) * 100
        print(f"  {behavior}: {count} observations ({percentage:.1f}%)")
    
    return df


def visualize_behavior(df):
    """Generate spatial map visualization only."""
    print("Creating spatial map visualization...")
    plt.figure(figsize=(12, 8))
    colors = {"Foraging": "#2E8B57", "Migrating": "#FF6B35"}

    # Spatial distribution map
    for behavior, color in colors.items():
        subset = df[df["behavior"] == behavior]
        plt.scatter(subset["longitude"], subset["latitude"], 
                   s=30, alpha=0.7, c=color, label=f"{behavior} (n={len(subset)})",
                   edgecolors='white', linewidth=0.5)
    
    plt.xlabel("Longitude (°)")
    plt.ylabel("Latitude (°)")
    plt.title("Shark Behavioral States - Spatial Distribution\nBased on PACE Satellite Data Analysis")
    plt.legend(fontsize=12, loc='best')
    plt.grid(True, alpha=0.3)
    
    # Add coastline-like appearance
    plt.gca().set_facecolor('#f0f8ff')  # Light blue background
    
    # Optimize axis limits to data range
    lon_margin = (df['longitude'].max() - df['longitude'].min()) * 0.05
    lat_margin = (df['latitude'].max() - df['latitude'].min()) * 0.05
    plt.xlim(df['longitude'].min() - lon_margin, df['longitude'].max() + lon_margin)
    plt.ylim(df['latitude'].min() - lat_margin, df['latitude'].max() + lat_margin)
    
    plt.tight_layout()
    plt.savefig("shark_behavior_map.png", dpi=300, bbox_inches='tight')
    plt.show()
    
    # Print summary statistics
    print("\nENVIRONMENTAL ANALYSIS SUMMARY:")
    print("=" * 50)
    for behavior in ["Foraging", "Migrating"]:
        subset = df[df["behavior"] == behavior]
        print(f"\n{behavior} Areas (n={len(subset)}):")
        print(f"  Chlorophyll-a: {subset['chlor_a'].mean():.3f} ± {subset['chlor_a'].std():.3f}")
        print(f"  Carbon Phyto: {subset['carbon_phyto'].mean():.1f} ± {subset['carbon_phyto'].std():.1f}")
        print(f"  POC: {subset['poc'].mean():.1f} ± {subset['poc'].std():.1f}")
        print(f"  Speed: {subset['speed_km_day'].mean():.1f} ± {subset['speed_km_day'].std():.1f} km/day")


def main():
    """Main prediction pipeline."""
    print("SHARK BEHAVIOR PREDICTION PIPELINE")
    print("=" * 50)
    
    try:
        # Load preprocessed data
        df = load_preprocessed_data()
        
        if df is None:
            return None
        
        # Train HMM model
        df = train_hmm(df)
        
        # Create visualizations
        visualize_behavior(df)
        
        print("\n" + "=" * 50)
        print("PREDICTION PIPELINE COMPLETE!")
        print(f"Analyzed {len(df)} observations from {df['shark_id'].nunique()} sharks")
        print("Spatial map saved as 'shark_behavior_map.png'")
        print("=" * 50)
        
        return df
        
    except Exception as e:
        print(f"Error in prediction pipeline: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    results = main()
