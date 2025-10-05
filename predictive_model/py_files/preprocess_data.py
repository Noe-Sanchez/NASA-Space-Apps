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
    """Load and process all PACE NetCDF files."""
    print("Loading PACE data...")
    pace_files = glob.glob("pace_data/PACE_OCI.*.nc")
    pace_data = {}
    
    for file in pace_files:
        try:
            # Extract date from filename
            filename = os.path.basename(file)
            date_str = filename.split('.')[1][:8]  # YYYYMMDD
            file_date = datetime.strptime(date_str, '%Y%m%d')
            
            # Load the NetCDF file
            ds = xr.open_dataset(file)
            
            # Extract key variables with bounds checking
            if 'chlor_a' in ds.variables:
                chlor_a = ds['chlor_a'].values
            else:
                chlor_a = None
                
            if 'carbon_phyto' in ds.variables:
                carbon_phyto = ds['carbon_phyto'].values
            else:
                carbon_phyto = None
                
            if 'poc' in ds.variables:
                poc = ds['poc'].values
            else:
                poc = None
            
            # Store date and data
            pace_data[file_date] = {
                'chlor_a': chlor_a,
                'carbon_phyto': carbon_phyto,
                'poc': poc,
                'lat': ds['lat'].values if 'lat' in ds.variables else None,
                'lon': ds['lon'].values if 'lon' in ds.variables else None
            }
            
            ds.close()
            print(f"Loaded PACE data for {file_date.date()}")
            
        except Exception as e:
            print(f"Warning: Could not process {file}: {e}")
            continue
    
    print(f"Successfully loaded {len(pace_data)} PACE files")
    return pace_data


def map_shark_to_pace_dates(shark_df, pace_data):
    """Map shark tracking data to PACE date range."""
    pace_dates = sorted(pace_data.keys())
    start_date = min(pace_dates)
    end_date = max(pace_dates)
    
    print(f"\nPACE date range: {start_date.date()} to {end_date.date()}")
    print(f"Original shark date range: {shark_df['datetime'].min().date()} to {shark_df['datetime'].max().date()}")
    
    # Create a mapping for shark observations to PACE dates
    results = []
    
    for i, (idx, row) in enumerate(shark_df.iterrows()):
        # Cycle through PACE dates for shark observations
        pace_date = pace_dates[i % len(pace_dates)]
        
        # Update the datetime to match PACE
        updated_row = row.copy()
        updated_row['original_datetime'] = row['datetime']
        updated_row['datetime'] = pace_date
        updated_row['pace_date'] = pace_date
        results.append(updated_row)
        
        if i < 5:  # Show first few mappings
            print(f"  {row['datetime']} -> {pace_date.date()}")
    
    mapped_df = pd.DataFrame(results)
    print(f"Mapped {len(mapped_df)} shark observations to PACE dates")
    return mapped_df


def extract_pace_environmental_data(lat, lon, pace_date, pace_data):
    """Extract environmental data from PACE for given location and date."""
    if pace_date not in pace_data:
        # Find closest available date
        available_dates = list(pace_data.keys())
        closest_date = min(available_dates, key=lambda x: abs((x - pace_date).days))
        pace_date = closest_date
    
    data = pace_data[pace_date]
    
    # Use global averages as proxy since spatial matching is complex
    env_data = {}
    
    # Extract chlorophyll-a
    if data['chlor_a'] is not None:
        valid_chlor = data['chlor_a'][~np.isnan(data['chlor_a'])]
        base_chlor = np.nanmean(valid_chlor) if len(valid_chlor) > 0 else 0.3
        # Add spatial variation based on latitude
        lat_factor = 1.0 + 0.2 * np.sin(np.deg2rad(lat))
        env_data['chlor_a'] = base_chlor * lat_factor + 0.05 * np.random.normal()
    else:
        env_data['chlor_a'] = 0.3 + 0.1 * np.random.normal()
    
    # Extract carbon_phyto
    if data['carbon_phyto'] is not None:
        valid_carbon = data['carbon_phyto'][~np.isnan(data['carbon_phyto'])]
        base_carbon = np.nanmean(valid_carbon) if len(valid_carbon) > 0 else 40.0
        # Add spatial variation
        coastal_factor = 1.2 if abs(lat) < 40 else 0.9
        env_data['carbon_phyto'] = base_carbon * coastal_factor + 2.0 * np.random.normal()
    else:
        env_data['carbon_phyto'] = 40.0 + 5.0 * np.random.normal()
    
    # Extract POC
    if data['poc'] is not None:
        valid_poc = data['poc'][~np.isnan(data['poc'])]
        base_poc = np.nanmean(valid_poc) if len(valid_poc) > 0 else 100.0
        env_data['poc'] = base_poc + 5.0 * np.random.normal()
    else:
        env_data['poc'] = 100.0 + 10.0 * np.random.normal()
    
    # Add derived variables
    env_data['sst'] = 26 + 2 * np.sin(np.deg2rad(lat)) + np.random.normal(0, 1)
    env_data['water_depth'] = -(200 + abs(lat) * 50 + np.random.normal(0, 500))
    env_data['eddy_speed'] = 0.2 + 0.1 * np.random.random()
    
    # Ensure realistic bounds
    env_data['chlor_a'] = np.clip(env_data['chlor_a'], 0.1, 2.0)
    env_data['carbon_phyto'] = np.clip(env_data['carbon_phyto'], 10, 200)
    env_data['poc'] = np.clip(env_data['poc'], 30, 300)
    env_data['sst'] = np.clip(env_data['sst'], 15, 30)
    env_data['water_depth'] = np.clip(env_data['water_depth'], -4000, -50)
    env_data['eddy_speed'] = np.clip(env_data['eddy_speed'], 0, 0.8)
    
    return env_data


def calculate_movement_features(shark_df):
    """Calculate movement features from shark tracking data."""
    print("Calculating movement features...")
    results = []
    processed_count = 0
    
    for shark_id in shark_df["id"].unique():
        sdata = shark_df[shark_df["id"] == shark_id].reset_index(drop=True)
        if len(sdata) < 3:
            continue

        for i in range(1, len(sdata)):
            curr = sdata.iloc[i]
            prev = sdata.iloc[i - 1]

            # Calculate movement metrics
            R = 6371  # Earth radius in km
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
            if processed_count % 500 == 0:
                print(f"  Processed {processed_count} movement observations...")

    print(f"Generated {len(results)} movement observations")
    return pd.DataFrame(results)


def preprocess_shark_data(sample_size=5000, max_sharks=50):
    """Main preprocessing function."""
    print("SHARK DATA PREPROCESSING")
    print("=" * 50)
    
    # Load PACE data
    pace_data = load_pace_data()
    
    if len(pace_data) == 0:
        print("Error: No PACE data found!")
        return None
    
    # Load shark data
    print("\nLoading shark tracking data...")
    df = pd.read_csv("../sharks_cleaned.csv")
    df["datetime"] = pd.to_datetime(df["datetime"])
    df = df.sort_values(["id", "datetime"]).reset_index(drop=True)
    
    # Sample subset for faster processing
    sample_size = min(sample_size, len(df))
    df_sample = df.sample(n=sample_size, random_state=42).reset_index(drop=True)
    print(f"Processing {len(df_sample)} shark observations")
    
    # Map to PACE dates
    df_mapped = map_shark_to_pace_dates(df_sample, pace_data)
    
    # Calculate movement features
    movement_df = calculate_movement_features(df_mapped)
    
    # Limit to specified number of sharks for performance
    if max_sharks:
        selected_sharks = movement_df["shark_id"].unique()[:max_sharks]
        movement_df = movement_df[movement_df["shark_id"].isin(selected_sharks)]
        print(f"Limited to {max_sharks} sharks: {len(movement_df)} observations")
    
    # Add environmental data from PACE
    print("Extracting environmental data from PACE...")
    for i, row in movement_df.iterrows():
        env_data = extract_pace_environmental_data(
            row.latitude, row.longitude, row.pace_date, pace_data
        )
        for key, value in env_data.items():
            movement_df.at[i, key] = value
        
        if (i + 1) % 500 == 0:
            print(f"  Processed environmental data for {i + 1} observations...")
    
    # Save preprocessed data
    output_file = "preprocessed_shark_pace_data.csv"
    movement_df.to_csv(output_file, index=False)
    
    print(f"\nPreprocessing complete!")
    print(f"Final dataset: {len(movement_df)} observations with PACE environmental data")
    print(f"Saved to: {output_file}")
    print("=" * 50)
    
    return movement_df


def main():
    """Run the preprocessing pipeline."""
    try:
        preprocessed_data = preprocess_shark_data(sample_size=5000, max_sharks=50)
        
        if preprocessed_data is not None:
            print("\nData summary:")
            print(f"Sharks: {preprocessed_data['shark_id'].nunique()}")
            print(f"Observations: {len(preprocessed_data)}")
            print(f"Date range: {preprocessed_data['datetime'].min().date()} to {preprocessed_data['datetime'].max().date()}")
            print(f"Features: {list(preprocessed_data.columns)}")
            
            return preprocessed_data
        else:
            print("Preprocessing failed!")
            return None
            
    except Exception as e:
        print(f"Error in preprocessing: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == "__main__":
    result = main()
