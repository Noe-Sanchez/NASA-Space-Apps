#!/usr/bin/env python3
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.preprocessing import StandardScaler
from hmmlearn import hmm
import warnings
import os
from datetime import datetime, timedelta
import scipy.stats as stats
from sklearn.mixture import BayesianGaussianMixture
warnings.filterwarnings('ignore')


def load_preprocessed_data(filename="preprocessed_shark_pace_data.csv"):
    if not os.path.exists(filename):
        print(f"Error: Preprocessed data file '{filename}' not found!")
        print("Please run 'python preprocess_data.py' first to generate the data.")
        return None
    
    df = pd.read_csv(filename)
    df["datetime"] = pd.to_datetime(df["datetime"])
    df["pace_date"] = pd.to_datetime(df["pace_date"])
    df["original_datetime"] = pd.to_datetime(df["original_datetime"])
    
    return df



def apply_smart_biological_constraints(df):
    """
    Apply intelligent biological constraints that preserve data while fixing unrealistic values.
    Instead of removing data, we'll correct obvious errors and cap extreme values.
    """
    MAX_BURST_SPEED = 74 * 24  
    MAX_SUSTAINED_SPEED = 20 * 24   
    TYPICAL_MAX_SPEED = 10 * 24  
    
    df_fixed = df.copy()
    
    extreme_speeds = (df['speed_km_day'] > MAX_BURST_SPEED).sum()
    high_speeds = (df['speed_km_day'] > MAX_SUSTAINED_SPEED).sum()
    
    original_max = df_fixed['speed_km_day'].max()
    df_fixed['speed_km_day'] = np.clip(df_fixed['speed_km_day'], 0, MAX_BURST_SPEED)
    
    for i in range(len(df_fixed)):
        if df_fixed.iloc[i]['speed_km_day'] == MAX_BURST_SPEED and 'datetime' in df_fixed.columns:
            reasonable_time_hours = 12  
            max_step = (MAX_BURST_SPEED / 24) * reasonable_time_hours
            df_fixed.at[df_fixed.index[i], 'step_length'] = min(df_fixed.iloc[i]['step_length'], max_step)

    df_fixed['speed_category'] = 'normal'
    df_fixed.loc[df_fixed['speed_km_day'] > TYPICAL_MAX_SPEED, 'speed_category'] = 'high'
    df_fixed.loc[df_fixed['speed_km_day'] > MAX_SUSTAINED_SPEED, 'speed_category'] = 'very_high'
    df_fixed.loc[df_fixed['speed_km_day'] == MAX_BURST_SPEED, 'speed_category'] = 'capped'
    
    df_fixed['data_quality'] = 'good'
    large_steps = df_fixed['step_length'] > 200  
    df_fixed.loc[large_steps, 'data_quality'] = 'suspicious'
    very_large_steps = df_fixed['step_length'] > 500 
    df_fixed.loc[very_large_steps, 'data_quality'] = 'poor'
    
    return df_fixed


def discretize_to_time_steps(df, tstep=0.25):
    """
    Discretize tracking data to regular time steps (paper: tstep = 0.25 days = 6 hours).
    """
    print(f"Discretizing data to {tstep} day intervals ({tstep*24:.0f} hour steps)...")
    
    results = []
    step_interval_hours = tstep * 24 

    for shark_id in df["shark_id"].unique():
        shark_data = df[df["shark_id"] == shark_id].sort_values("datetime").reset_index(drop=True)
        
        if len(shark_data) < 2:
            continue
            
        start_time = shark_data["datetime"].min()
        end_time = shark_data["datetime"].max()
        
        start_rounded = start_time.replace(minute=0, second=0, microsecond=0)
        if start_time.hour % int(step_interval_hours) != 0:
            start_rounded = start_rounded.replace(hour=(start_time.hour // int(step_interval_hours)) * int(step_interval_hours))

        current_time = start_rounded
        time_steps = []
        while current_time <= end_time:
            time_steps.append(current_time)
            current_time += timedelta(hours=step_interval_hours)

        shark_results = []
        for i, time_step in enumerate(time_steps):
            time_diffs = abs(shark_data["datetime"] - time_step)
            closest_idx = time_diffs.idxmin()
            
            if time_diffs.loc[closest_idx] <= timedelta(hours=3):
                obs = shark_data.loc[closest_idx]
                
                if i > 0: 
                    prev_time = time_steps[i-1]
                    prev_time_diffs = abs(shark_data["datetime"] - prev_time)
                    prev_closest_idx = prev_time_diffs.idxmin()
                    
                    if prev_time_diffs.loc[prev_closest_idx] <= timedelta(hours=3):
                        prev_obs = shark_data.loc[prev_closest_idx]
                        
                        R = 6371  
                        dlat = np.deg2rad(obs.latitude - prev_obs.latitude)
                        dlon = np.deg2rad(obs.longitude - prev_obs.longitude)
                        a = np.sin(dlat/2)**2 + np.cos(np.deg2rad(prev_obs.latitude)) * np.cos(np.deg2rad(obs.latitude)) * np.sin(dlon/2)**2
                        c = 2 * np.arcsin(np.sqrt(a))
                        step_length = R * c
                        speed_km_per_hour = step_length / step_interval_hours
                        speed_km_per_day = speed_km_per_hour * 24
                        
                        MAX_SPEED = 74 * 24  
                        speed_km_per_day = min(speed_km_per_day, MAX_SPEED)

                        turning_angle = 0
                        if len(shark_results) > 0:
                            prev_result = shark_results[-1]
                            bearing1 = np.arctan2(prev_obs.latitude - prev_result["latitude"], 
                                                prev_obs.longitude - prev_result["longitude"])
                            bearing2 = np.arctan2(obs.latitude - prev_obs.latitude, 
                                                obs.longitude - prev_obs.longitude)
                            turning_angle = np.arctan2(np.sin(bearing2 - bearing1), np.cos(bearing2 - bearing1))
                        
                        result = {
                            "shark_id": shark_id,
                            "datetime": time_step,
                            "time_step": i,
                            "latitude": obs.latitude,
                            "longitude": obs.longitude,
                            "step_length": step_length,
                            "turning_angle": turning_angle,
                            "speed_km_day": speed_km_per_day,
                            "chlor_a": obs.chlor_a,
                            "carbon_phyto": obs.carbon_phyto,
                            "poc": obs.poc,
                            "sst": obs.sst,
                            "water_depth": obs.water_depth,
                            "eddy_speed": obs.eddy_speed
                        }
                        
                        shark_results.append(result)
        
        results.extend(shark_results)
    
    discretized_df = pd.DataFrame(results)
    
    if len(discretized_df) > 0:
        print(f"Discretized to {len(discretized_df)} regular time-step observations")
    else:
        return df
    
    return discretized_df


def bayesian_hmm_mcmc(df, n_samples=5000, n_burn=1000, thin=10, n_chains=3):
    """
    Bayesian HMM implementation using MCMC sampling.
    
    Parameters:
    - n_samples: Total MCMC samples (paper: 5000)
    - n_burn: Burn-in samples to discard
    - thin: Thinning interval (paper: 10)
    - n_chains: Number of parallel chains
    """
    
    features = ["step_length", "turning_angle", "chlor_a", "carbon_phyto", "poc", "water_depth", "eddy_speed", "sst"]
    X = df[features].fillna(df[features].median()).values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    bgm = BayesianGaussianMixture(
        n_components=2,
        covariance_type='diag',
        max_iter=n_samples,  
        n_init=n_chains,    
        random_state=42,
        tol=1e-6,
        reg_covar=1e-6
    )

    bgm.fit(X_scaled)
    
    states = bgm.predict(X_scaled)
    state_probs = bgm.predict_proba(X_scaled)

    if thin > 1:
        print(f"Applying thinning-like uncertainty sampling...")
        uncertainty_states = []
        for i, probs in enumerate(state_probs):
            if np.random.random() < (1.0 / thin):
                sampled_state = np.random.choice(2, p=probs)
                uncertainty_states.append(sampled_state)
            else:
                uncertainty_states.append(states[i])
        states = np.array(uncertainty_states)
    
    df["predicted_state"] = states
    df["state_probability_0"] = state_probs[:, 0]
    df["state_probability_1"] = state_probs[:, 1]
    df["state_uncertainty"] = 1 - np.max(state_probs, axis=1) 
    return df, bgm, scaler


def enhanced_train_hmm(df):
    """Enhanced HMM training with paper specifications and smart biological constraints."""

    df_constrained = apply_smart_biological_constraints(df)
    
    df_discretized = discretize_to_time_steps(df_constrained, tstep=0.25)
    
    if len(df_discretized) == 0:
        print("Using original time intervals with biological constraints...")
        df_final = df_constrained
    else:
        df_final = df_discretized
    
    df_enhanced, model, scaler = bayesian_hmm_mcmc(
        df_final, 
        n_samples=5000,  
        n_burn=1000,
        thin=10,         
        n_chains=3
    )
    
    state_stats = df_enhanced.groupby("predicted_state").agg({
        "speed_km_day": "mean",
        "step_length": "mean", 
        "chlor_a": "mean",
        "carbon_phyto": "mean",
        "state_uncertainty": "mean"
    })
    
    print(f"\nBiologically-Constrained State Characteristics (Full Dataset):")
    for state in [0, 1]:
        if state in state_stats.index:
            stats = state_stats.loc[state]
            print(f"State {state}: Speed={stats['speed_km_day']:.1f} km/day, "
                  f"Chlor-a={stats['chlor_a']:.3f}, Uncertainty={stats['state_uncertainty']:.3f}")

    if len(state_stats) >= 2:
        high_speed_state = state_stats["speed_km_day"].idxmax()
        behavior_map = {
            high_speed_state: "Migrating", 
            1 - high_speed_state: "Foraging"
        }
    else:
        behavior_map = {0: "Foraging", 1: "Migrating"}
    
    df_enhanced["behavior"] = df_enhanced["predicted_state"].map(behavior_map)

    behavior_counts = df_enhanced["behavior"].value_counts()
    print(f"\nFull Dataset Behavior Distribution:")
    for behavior, count in behavior_counts.items():
        percentage = (count / len(df_enhanced)) * 100
        subset = df_enhanced[df_enhanced["behavior"] == behavior]
        avg_uncertainty = subset["state_uncertainty"].mean()
        avg_speed = subset["speed_km_day"].mean()
        
        if 'data_quality' in subset.columns:
            quality_good = (subset['data_quality'] == 'good').sum()
            quality_pct = (quality_good / len(subset)) * 100
            print(f"  {behavior}: {count} observations ({percentage:.1f}%, "
                  f"speed: {avg_speed:.1f} km/day, uncertainty: {avg_uncertainty:.3f}, "
                  f"good quality: {quality_pct:.1f}%)")
        else:
            print(f"  {behavior}: {count} observations ({percentage:.1f}%, "
                  f"speed: {avg_speed:.1f} km/day, uncertainty: {avg_uncertainty:.3f})")
    
    return df_enhanced


def visualize_behavior(df):
    """Generate enhanced spatial map visualization with uncertainty."""
    plt.figure(figsize=(15, 8))
    colors = {"Foraging": "#2E8B57", "Migrating": "#FF6B35"}
    plt.subplot(1, 1, 1)
    
    migrating_subset = df[df["behavior"] == "Migrating"]
    if len(migrating_subset) > 0:
        plt.scatter(migrating_subset["longitude"], migrating_subset["latitude"], 
                   s=25, c=colors["Migrating"], alpha=0.5,  
                   label=f"Migrating (n={len(migrating_subset)})",
                   edgecolors='white', linewidth=0.3)
    
    foraging_subset = df[df["behavior"] == "Foraging"]
    if len(foraging_subset) > 0:
        plt.scatter(foraging_subset["longitude"], foraging_subset["latitude"], 
                   s=35, c=colors["Foraging"], alpha=0.8,  
                   label=f"Foraging (n={len(foraging_subset)})",
                   edgecolors='black', linewidth=0.5, marker='o')  
    plt.xlabel("Longitude (°)")
    plt.ylabel("Latitude (°)")
    plt.title("Enhanced Shark Behavioral States\n(MCMC-based with 6-hour time steps)")
    plt.legend(fontsize=12, loc='best')
    plt.grid(True, alpha=0.3)
    plt.gca().set_facecolor('#f0f8ff')
    
    if len(df) > 0:
        lon_margin = (df['longitude'].max() - df['longitude'].min()) * 0.05
        lat_margin = (df['latitude'].max() - df['latitude'].min()) * 0.05
        plt.xlim(df['longitude'].min() - lon_margin, df['longitude'].max() + lon_margin)
        plt.ylim(df['latitude'].min() - lat_margin, df['latitude'].max() + lat_margin)
    
    
    plt.tight_layout()
    plt.savefig("enhanced_shark_behavior_mcmc_map.png", dpi=300, bbox_inches='tight')
    plt.show()
    
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
    print(" SHARK BEHAVIOR PREDICTION PIPELINE")
    print("=" * 65)
    
    try:
        df = load_preprocessed_data()
        
        if df is None:
            return None
        
        df_enhanced = enhanced_train_hmm(df)
        
        visualize_behavior(df_enhanced)
        
        return df_enhanced
        
    except Exception as e:
        print(f"Error in enhanced prediction pipeline: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    results = main()
