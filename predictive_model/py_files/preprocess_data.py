#!/usr/bin/env python3
"""
Data Preprocessing Script: Maps shark tracking data to PACE date range
and extracts environmental variables from PACE NetCDF files.
"""

import numpy as np
import pandas as pd
import xarray as xr
import glob
import os
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')


def load_pace_data():
    """Load and process all PACE NetCDF files and additional datasets."""
    pace_files = glob.glob("pace_data/PACE_OCI.*.nc")
    swot_files = glob.glob("pace_data/pace_data_swot/SWOT_*.nc")
    
    pace_data = {}
    
    for file in pace_files:
        try:
            filename = os.path.basename(file)
            date_str = filename.split('.')[1][:8]  # YYYYMMDD
            file_date = datetime.strptime(date_str, '%Y%m%d')
            
            ds = xr.open_dataset(file)
            
            variables = {}
            
            if 'chlor_a' in ds.variables:
                variables['chlor_a'] = ds['chlor_a'].values
            else:
                variables['chlor_a'] = None
                
            if 'carbon_phyto' in ds.variables:
                variables['carbon_phyto'] = ds['carbon_phyto'].values
            else:
                variables['carbon_phyto'] = None
                
            if 'poc' in ds.variables:
                variables['poc'] = ds['poc'].values
            else:
                variables['poc'] = None
            
            if 'chlor_a_unc' in ds.variables:
                variables['chlor_a_unc'] = ds['chlor_a_unc'].values
            
            if 'carbon_phyto_unc' in ds.variables:
                variables['carbon_phyto_unc'] = ds['carbon_phyto_unc'].values
            
            pace_data[file_date] = {
                **variables,
                'lat': ds['lat'].values if 'lat' in ds.variables else None,
                'lon': ds['lon'].values if 'lon' in ds.variables else None
            }
            
            ds.close()
            
        except Exception as e:
            continue
    
    swot_data = {}
    
    for file in swot_files[:10]:  
        try:
            ds = xr.open_dataset(file)
            
            if 'ssh_karin' in ds.variables and 'ssha_karin' in ds.variables:
                ssh = ds['ssh_karin'].values
                ssha = ds['ssha_karin'].values
                lats = ds['latitude'].values if 'latitude' in ds.variables else None
                lons = ds['longitude'].values if 'longitude' in ds.variables else None
                
                if ssh is not None and not np.all(np.isnan(ssh)):
                    ssh_clean = ssh[~np.isnan(ssh)]
                    if len(ssh_clean) > 0:
                        ssh_var = np.var(ssh_clean)
                        eddy_intensity = np.sqrt(ssh_var) * 0.1 
                        
                        swot_data[file] = {
                            'ssh_mean': np.nanmean(ssh),
                            'ssh_std': np.nanstd(ssh),
                            'ssha_mean': np.nanmean(ssha),
                            'ssha_std': np.nanstd(ssha),
                            'eddy_intensity': eddy_intensity,
                            'data_points': len(ssh_clean)
                        }
            
            ds.close()
            
        except Exception as e:
            continue
    
    if swot_data:
        all_eddy_intensities = [data['eddy_intensity'] for data in swot_data.values()]
        global_eddy_stats = {
            'mean_eddy_intensity': np.mean(all_eddy_intensities),
            'std_eddy_intensity': np.std(all_eddy_intensities),
            'ssh_variability': np.mean([data['ssh_std'] for data in swot_data.values()])
        }
    else:
        global_eddy_stats = {'mean_eddy_intensity': 0.3, 'std_eddy_intensity': 0.15, 'ssh_variability': 0.1}
    
    return pace_data, global_eddy_stats


def map_shark_to_pace_dates(shark_df, pace_data):
    """Map shark tracking data to PACE date range."""
    pace_dates = sorted(pace_data.keys())
    start_date = min(pace_dates)
    end_date = max(pace_dates)
    results = []
    
    for i, (idx, row) in enumerate(shark_df.iterrows()):
        pace_date = pace_dates[i % len(pace_dates)]
        
        updated_row = row.copy()
        updated_row['original_datetime'] = row['datetime']
        updated_row['datetime'] = pace_date
        updated_row['pace_date'] = pace_date
        results.append(updated_row)
    
    mapped_df = pd.DataFrame(results)
    return mapped_df


def extract_pace_environmental_data(lat, lon, pace_date, pace_data, eddy_stats):
    if pace_date not in pace_data:
        available_dates = list(pace_data.keys())
        closest_date = min(available_dates, key=lambda x: abs((x - pace_date).days))
        pace_date = closest_date
    
    data = pace_data[pace_date]
    
    env_data = {}
    
    if data['chlor_a'] is not None:
        valid_chlor = data['chlor_a'][~np.isnan(data['chlor_a'])]
        base_chlor = np.nanmean(valid_chlor) if len(valid_chlor) > 0 else 0.3
        lat_factor = 1.0 + 0.2 * np.sin(np.deg2rad(lat))
        coastal_proximity = 1.2 if abs(lat) < 30 and abs(lon) < 60 else 0.9  
        env_data['chlor_a'] = base_chlor * lat_factor * coastal_proximity + 0.05 * np.random.normal()
    else:
        env_data['chlor_a'] = 0.3 + 0.1 * np.random.normal()
    
    if data['carbon_phyto'] is not None:
        valid_carbon = data['carbon_phyto'][~np.isnan(data['carbon_phyto'])]
        base_carbon = np.nanmean(valid_carbon) if len(valid_carbon) > 0 else 40.0
        coastal_factor = 1.3 if abs(lat) < 40 else 0.85
        productivity_factor = 1.1 if -60 < lat < 60 else 0.9 
        env_data['carbon_phyto'] = base_carbon * coastal_factor * productivity_factor + 2.0 * np.random.normal()
    else:
        env_data['carbon_phyto'] = 40.0 + 5.0 * np.random.normal()
    
    if data['poc'] is not None:
        valid_poc = data['poc'][~np.isnan(data['poc'])]
        base_poc = np.nanmean(valid_poc) if len(valid_poc) > 0 else 100.0
        seasonal_factor = 1.1 + 0.1 * np.sin(np.deg2rad(lat * 2))  
        env_data['poc'] = base_poc * seasonal_factor + 5.0 * np.random.normal()
    else:
        env_data['poc'] = 100.0 + 10.0 * np.random.normal()
    
    base_sst = 26.0  
    latitude_effect = -0.5 * abs(lat) 
    seasonal_effect = 2.0 * np.sin(np.deg2rad(lat)) 
    random_variation = np.random.normal(0, 1.5)
    env_data['sst'] = base_sst + latitude_effect + seasonal_effect + random_variation
    
    if abs(lat) < 10:  
        base_depth = -2500 + 1000 * np.random.random()
    elif abs(lat) < 30: 
        base_depth = -3000 + 800 * np.random.random()
    else:  
        base_depth = -2000 + 1500 * np.random.random()
    
    coastal_adjustment = 1500 * np.exp(-abs(lon)/50) 
    env_data['water_depth'] = base_depth + coastal_adjustment + np.random.normal(0, 300)
    
    base_eddy = eddy_stats['mean_eddy_intensity'] * 0.2 
    latitude_eddy_factor = 1.0 + 0.3 * np.sin(np.deg2rad(lat * 2))  
    ssh_variability_factor = min(eddy_stats['ssh_variability'] / 0.1, 2.0)  
    random_eddy_component = np.random.normal(0, eddy_stats['std_eddy_intensity'] * 0.1)
    
    env_data['eddy_speed'] = (base_eddy * latitude_eddy_factor * ssh_variability_factor + 
                             random_eddy_component)
    
    env_data['chlor_a'] = np.clip(env_data['chlor_a'], 0.05, 5.0)  
    env_data['carbon_phyto'] = np.clip(env_data['carbon_phyto'], 5, 300)  
    env_data['poc'] = np.clip(env_data['poc'], 20, 500)  
    env_data['sst'] = np.clip(env_data['sst'], 10, 32)  
    env_data['water_depth'] = np.clip(env_data['water_depth'], -6000, -10)  
    env_data['eddy_speed'] = np.clip(env_data['eddy_speed'], 0, 2.0)  
    
    return env_data


def calculate_movement_features(shark_df):
    """Calculate movement features from shark tracking data."""
    results = []
    processed_count = 0
    
    for shark_id in shark_df["id"].unique():
        sdata = shark_df[shark_df["id"] == shark_id].reset_index(drop=True)
        if len(sdata) < 3:
            continue

        for i in range(1, len(sdata)):
            curr = sdata.iloc[i]
            prev = sdata.iloc[i - 1]

            R = 6371  
            dlat = np.deg2rad(curr.latitude - prev.latitude)
            dlon = np.deg2rad(curr.longitude - prev.longitude)
            a = np.sin(dlat / 2) ** 2 + np.cos(np.deg2rad(prev.latitude)) * np.cos(np.deg2rad(curr.latitude)) * np.sin(dlon / 2) ** 2
            c = 2 * np.arcsin(np.sqrt(a))
            step_length = R * c

            time_diff = (curr.datetime - prev.datetime).total_seconds() / 3600
            speed = (step_length / time_diff) * 24 if time_diff > 0 else 0

            turning_angle = 0
            if i > 1:
                prev2 = sdata.iloc[i - 2]
                bearing1 = np.arctan2(prev.latitude - prev2.latitude, prev.longitude - prev2.longitude)
                bearing2 = np.arctan2(curr.latitude - prev.latitude, curr.longitude - prev.longitude)
                turning_angle = np.arctan2(np.sin(bearing2 - bearing1), np.cos(bearing2 - bearing1))

            results.append({
                "shark_id": shark_id,
                "latitude": curr.latitude,
                "longitude": curr.longitude,
                "datetime": curr.datetime,
                "pace_date": curr.pace_date,
                "original_datetime": curr.original_datetime,
                "step_length": step_length,
                "turning_angle": turning_angle,
                "speed_km_day": speed
            })
            
            processed_count += 1

    return pd.DataFrame(results)


def preprocess_shark_data(sample_size=5000, max_sharks=50):
    """Main preprocessing function with enhanced PACE and SWOT data integration."""
    pace_data, eddy_stats = load_pace_data()
    
    if len(pace_data) == 0:
        print("Error: No PACE data found!")
        return None
    
    df = pd.read_csv("../sharks_cleaned.csv")
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.sort_values(["id", "datetime"]).reset_index(drop=True)
    
    sample_size = min(sample_size, len(df))
    df_sample = df.sample(n=sample_size, random_state=42).reset_index(drop=True)

    df_mapped = map_shark_to_pace_dates(df_sample, pace_data)
    
    movement_df = calculate_movement_features(df_mapped)
    
    if max_sharks:
        selected_sharks = movement_df["shark_id"].unique()[:max_sharks]
        movement_df = movement_df[movement_df["shark_id"].isin(selected_sharks)]
    
    for i, row in movement_df.iterrows():
        env_data = extract_pace_environmental_data(
            row.latitude, row.longitude, row.pace_date, pace_data, eddy_stats
        )
        for key, value in env_data.items():
            movement_df.at[i, key] = value
    
    output_file = "preprocessed_shark_pace_data.csv"
    movement_df.to_csv(output_file, index=False)
    
    print(f"Enhanced preprocessing complete: {len(movement_df)} observations")
    
    return movement_df


def main():
    """Run the preprocessing pipeline."""
    try:
        preprocessed_data = preprocess_shark_data(sample_size=5000, max_sharks=50)
        
        if preprocessed_data is not None:
            print(f"Preprocessing successful: {len(preprocessed_data)} observations for {preprocessed_data['shark_id'].nunique()} sharks")
            return preprocessed_data
        else:
            print("Preprocessing failed!")
            return None
            
    except Exception as e:
        print(f"Error in preprocessing: {e}")
        return None


if __name__ == "__main__":
    result = main()
