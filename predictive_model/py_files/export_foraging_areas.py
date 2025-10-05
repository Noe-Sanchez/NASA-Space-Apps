#!/usr/bin/env python3
"""
Export Foraging Areas to CSV
Converts HMM analysis results to CSV format

"""

import pandas as pd
import numpy as np
from FInalModel import load_preprocessed_data, enhanced_train_hmm
import os


def export_foraging_areas_csv(df_enhanced, output_filename="shark_foraging_areas.csv"):
    """
    Export shark behavioral states and foraging areas to CSV format.
    
    Parameters:
    - df_enhanced: DataFrame with HMM results from FInalModel
    - output_filename: Name of output CSV file
    
    Returns:
    - Path to the created CSV file
    """
    # Create a clean export DataFrame with essential columns for plotting
    export_df = df_enhanced[[
        'shark_id', 
        'latitude', 
        'longitude', 
        'datetime',
        'behavior',
        'predicted_state',
        'state_probability_0',
        'state_probability_1', 
        'state_uncertainty',
        'speed_km_day',
        'step_length',
        'chlor_a',
        'carbon_phyto',
        'poc',
        'sst',
        'water_depth',
        'eddy_speed'
    ]].copy()
    
    # Add derived columns for easier analysis
    export_df['is_foraging'] = (export_df['behavior'] == 'Foraging').astype(int)
    export_df['is_migrating'] = (export_df['behavior'] == 'Migrating').astype(int)
    export_df['confidence'] = 1 - export_df['state_uncertainty']
    
    # Add quality flags for filtering
    export_df['high_confidence'] = (export_df['confidence'] >= 0.7).astype(int)
    export_df['speed_category'] = pd.cut(export_df['speed_km_day'], 
                                       bins=[0, 50, 150, 300, 2000], 
                                       labels=['Low', 'Medium', 'High', 'Very_High'])
    
    # Round coordinates for better readability
    export_df['latitude'] = export_df['latitude'].round(6)
    export_df['longitude'] = export_df['longitude'].round(6)
    export_df['chlor_a'] = export_df['chlor_a'].round(4)
    export_df['carbon_phyto'] = export_df['carbon_phyto'].round(2)
    export_df['poc'] = export_df['poc'].round(2)
    export_df['sst'] = export_df['sst'].round(2)
    export_df['speed_km_day'] = export_df['speed_km_day'].round(2)
    export_df['step_length'] = export_df['step_length'].round(3)
    export_df['confidence'] = export_df['confidence'].round(3)
    export_df['state_uncertainty'] = export_df['state_uncertainty'].round(3)
    export_df['eddy_speed'] = export_df['eddy_speed'].round(4)
    
    # Save to CSV
    export_df.to_csv(output_filename, index=False)
    
    print(f"Exported {len(export_df)} observations to {output_filename}")
    
    return output_filename


def create_foraging_summary_csv(df_enhanced, output_filename="foraging_areas_summary.csv"):
    """
    Create a summary CSV with aggregated foraging area statistics.
    
    This creates a simplified dataset perfect for mapping hotspots.
    """
    # Filter for foraging behavior only
    foraging_df = df_enhanced[df_enhanced['behavior'] == 'Foraging'].copy()
    
    if len(foraging_df) == 0:
        print("Warning: No foraging observations found!")
        return None
    
    # Create spatial bins for aggregation (0.1 degree grid ~ 11km resolution)
    foraging_df['lat_bin'] = (foraging_df['latitude'] / 0.1).round() * 0.1
    foraging_df['lon_bin'] = (foraging_df['longitude'] / 0.1).round() * 0.1
    
    # Aggregate by spatial bins
    summary_df = foraging_df.groupby(['lat_bin', 'lon_bin']).agg({
        'shark_id': 'nunique',  # Number of unique sharks
        'behavior': 'count',    # Number of foraging observations
        'state_uncertainty': 'mean',   # Average uncertainty (lower is better)
        'speed_km_day': 'mean', # Average speed
        'chlor_a': 'mean',      # Average chlorophyll
        'carbon_phyto': 'mean', # Average carbon
        'poc': 'mean',          # Average POC
        'sst': 'mean',          # Average SST
        'water_depth': 'mean',  # Average depth
        'eddy_speed': 'mean'    # Average eddy speed
    }).reset_index()
    
    # Rename columns for clarity
    summary_df.columns = [
        'latitude', 'longitude', 'unique_sharks', 'foraging_observations',
        'avg_uncertainty', 'avg_speed_km_day', 'avg_chlor_a', 'avg_carbon_phyto',
        'avg_poc', 'avg_sst', 'avg_water_depth', 'avg_eddy_speed'
    ]
    
    # Add derived metrics
    summary_df['avg_confidence'] = 1 - summary_df['avg_uncertainty']
    summary_df['foraging_intensity'] = summary_df['foraging_observations'] * summary_df['avg_confidence']
    summary_df['shark_diversity'] = summary_df['unique_sharks'] / summary_df['foraging_observations']
    
    # Round values
    summary_df['latitude'] = summary_df['latitude'].round(3)
    summary_df['longitude'] = summary_df['longitude'].round(3)
    summary_df['avg_confidence'] = summary_df['avg_confidence'].round(3)
    summary_df['avg_uncertainty'] = summary_df['avg_uncertainty'].round(3)
    summary_df['avg_speed_km_day'] = summary_df['avg_speed_km_day'].round(2)
    summary_df['avg_chlor_a'] = summary_df['avg_chlor_a'].round(4)
    summary_df['avg_carbon_phyto'] = summary_df['avg_carbon_phyto'].round(2)
    summary_df['avg_poc'] = summary_df['avg_poc'].round(2)
    summary_df['avg_sst'] = summary_df['avg_sst'].round(2)
    summary_df['avg_water_depth'] = summary_df['avg_water_depth'].round(1)
    summary_df['avg_eddy_speed'] = summary_df['avg_eddy_speed'].round(4)
    summary_df['foraging_intensity'] = summary_df['foraging_intensity'].round(2)
    summary_df['shark_diversity'] = summary_df['shark_diversity'].round(3)
    
    # Sort by foraging intensity (most important areas first)
    summary_df = summary_df.sort_values('foraging_intensity', ascending=False)
    
    # Save to CSV
    summary_df.to_csv(output_filename, index=False)
    
    print(f"Created {len(summary_df)} foraging hotspots in {output_filename}")
    
    return output_filename


def generate_plotting_csvs():
    """
    Main function to generate CSV files for plotting foraging areas.
    """
    try:
        # Load preprocessed data
        df = load_preprocessed_data()
        
        if df is None:
            print("Error: Could not load preprocessed data!")
            print("Please run 'python preprocess_data.py' first.")
            return None
        
        # Run HMM analysis
        df_enhanced = enhanced_train_hmm(df)
        
        # Export detailed results
        detailed_file = export_foraging_areas_csv(df_enhanced, "shark_foraging_areas_detailed.csv")
        
        # Export summary for hotspot mapping
        summary_file = create_foraging_summary_csv(df_enhanced, "shark_foraging_hotspots.csv")
        
        print(f"CSV files created: {detailed_file}, {summary_file}")
        
        return detailed_file, summary_file
        
    except Exception as e:
        print(f"Error generating CSV files: {e}")
        import traceback
        traceback.print_exc()
        return None



if __name__ == "__main__":
    result = generate_plotting_csvs()
    
    if result:
        print("Generated CSV files.")
    else:
        print("Failed to generate CSV files. Please check your data and try again.")
