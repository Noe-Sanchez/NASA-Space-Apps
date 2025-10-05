#!/usr/bin/env python3
"""
Export Foraging Areas to CSV
Converts HMM analysis results to CSV format for easy plotting of shark foraging locations.
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
    print(f"Exporting foraging areas to {output_filename}...")
    
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
        'water_depth'
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
    
    # Save to CSV
    export_df.to_csv(output_filename, index=False)
    
    # Print summary statistics
    print(f"\nExport Summary:")
    print(f"  Total observations: {len(export_df)}")
    print(f"  Unique sharks: {export_df['shark_id'].nunique()}")
    print(f"  Foraging observations: {export_df['is_foraging'].sum()} ({export_df['is_foraging'].mean()*100:.1f}%)")
    print(f"  Migrating observations: {export_df['is_migrating'].sum()} ({export_df['is_migrating'].mean()*100:.1f}%)")
    print(f"  High confidence observations: {export_df['high_confidence'].sum()} ({export_df['high_confidence'].mean()*100:.1f}%)")
    
    print(f"\nForaging Areas Summary:")
    foraging_data = export_df[export_df['is_foraging'] == 1]
    if len(foraging_data) > 0:
        print(f"  Latitude range: {foraging_data['latitude'].min():.3f} to {foraging_data['latitude'].max():.3f}")
        print(f"  Longitude range: {foraging_data['longitude'].min():.3f} to {foraging_data['longitude'].max():.3f}")
        print(f"  Average chlorophyll-a: {foraging_data['chlor_a'].mean():.4f}")
        print(f"  Average carbon phyto: {foraging_data['carbon_phyto'].mean():.2f}")
        print(f"  Average speed: {foraging_data['speed_km_day'].mean():.2f} km/day")
        print(f"  Average confidence: {foraging_data['confidence'].mean():.3f}")
    
    return output_filename


def create_foraging_summary_csv(df_enhanced, output_filename="foraging_areas_summary.csv"):
    """
    Create a summary CSV with aggregated foraging area statistics.
    
    This creates a simplified dataset perfect for mapping hotspots.
    """
    print(f"Creating foraging summary for {output_filename}...")
    
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
        'water_depth': 'mean'   # Average depth
    }).reset_index()
    
    # Rename columns for clarity
    summary_df.columns = [
        'latitude', 'longitude', 'unique_sharks', 'foraging_observations',
        'avg_uncertainty', 'avg_speed_km_day', 'avg_chlor_a', 'avg_carbon_phyto',
        'avg_poc', 'avg_sst', 'avg_water_depth'
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
    summary_df['foraging_intensity'] = summary_df['foraging_intensity'].round(2)
    summary_df['shark_diversity'] = summary_df['shark_diversity'].round(3)
    
    # Sort by foraging intensity (most important areas first)
    summary_df = summary_df.sort_values('foraging_intensity', ascending=False)
    
    # Save to CSV
    summary_df.to_csv(output_filename, index=False)
    
    print(f"\nForaging Summary Export:")
    print(f"  Foraging hotspots identified: {len(summary_df)}")
    print(f"  Top hotspot: ({summary_df.iloc[0]['latitude']:.3f}, {summary_df.iloc[0]['longitude']:.3f})")
    print(f"    - {summary_df.iloc[0]['foraging_observations']} observations")
    print(f"    - {summary_df.iloc[0]['unique_sharks']} sharks")
    print(f"    - Intensity: {summary_df.iloc[0]['foraging_intensity']:.2f}")
    
    return output_filename


def generate_plotting_csvs():
    """
    Main function to generate CSV files for plotting foraging areas.
    """
    print("GENERATING FORAGING AREA CSV FILES")
    print("=" * 50)
    
    try:
        # Load preprocessed data
        print("Loading preprocessed data...")
        df = load_preprocessed_data()
        
        if df is None:
            print("Error: Could not load preprocessed data!")
            print("Please run 'python preprocess_data.py' first.")
            return None
        
        # Run HMM analysis
        print("Running HMM analysis...")
        df_enhanced = enhanced_train_hmm(df)
        
        # Export detailed results
        detailed_file = export_foraging_areas_csv(df_enhanced, "shark_foraging_areas_detailed.csv")
        
        # Export summary for hotspot mapping
        summary_file = create_foraging_summary_csv(df_enhanced, "shark_foraging_hotspots.csv")
        
        print(f"\n" + "=" * 50)
        print("CSV FILES CREATED FOR PLOTTING:")
        print(f"1. {detailed_file} - Complete dataset with all observations")
        print(f"2. {summary_file} - Aggregated foraging hotspots")
        print("\nRECOMMENDED PLOTTING APPROACHES:")
        print("For individual tracks: Use detailed CSV, plot by shark_id")
        print("For hotspot mapping: Use hotspots CSV, plot foraging_intensity")
        print("For behavior comparison: Filter detailed CSV by 'behavior' column")
        print("For high-confidence areas: Filter by 'high_confidence' == 1")
        
        return detailed_file, summary_file
        
    except Exception as e:
        print(f"Error generating CSV files: {e}")
        import traceback
        traceback.print_exc()
        return None


def create_plotting_examples():
    """
    Generate example plotting code snippets to help with visualization.
    """
    example_code = '''
# EXAMPLE PLOTTING CODE FOR GENERATED CSV FILES

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# 1. Load the detailed foraging data
df = pd.read_csv("shark_foraging_areas_detailed.csv")

# 2. Basic foraging vs migrating plot
plt.figure(figsize=(12, 8))
foraging = df[df['is_foraging'] == 1]
migrating = df[df['is_migrating'] == 1]

plt.scatter(migrating['longitude'], migrating['latitude'], 
           c='orange', alpha=0.6, s=20, label='Migrating')
plt.scatter(foraging['longitude'], foraging['latitude'], 
           c='green', alpha=0.8, s=30, label='Foraging')
plt.xlabel('Longitude')
plt.ylabel('Latitude')
plt.title('Shark Behavior: Foraging vs Migrating Areas')
plt.legend()
plt.show()

# 3. High-confidence foraging areas only
high_conf_foraging = df[(df['is_foraging'] == 1) & (df['high_confidence'] == 1)]
plt.figure(figsize=(10, 8))
scatter = plt.scatter(high_conf_foraging['longitude'], 
                     high_conf_foraging['latitude'],
                     c=high_conf_foraging['chlor_a'], 
                     s=50, alpha=0.7, cmap='viridis')
plt.colorbar(scatter, label='Chlorophyll-a')
plt.title('High-Confidence Foraging Areas by Chlorophyll Concentration')
plt.show()

# 4. Load and plot foraging hotspots
hotspots = pd.read_csv("shark_foraging_hotspots.csv")
plt.figure(figsize=(12, 8))
scatter = plt.scatter(hotspots['longitude'], hotspots['latitude'],
                     s=hotspots['foraging_intensity']*10,
                     c=hotspots['unique_sharks'], 
                     alpha=0.7, cmap='Reds')
plt.colorbar(scatter, label='Number of Sharks')
plt.xlabel('Longitude')
plt.ylabel('Latitude')
plt.title('Foraging Hotspots (Size = Intensity, Color = Shark Count)')
plt.show()
'''
    
    with open("plotting_examples.py", "w") as f:
        f.write(example_code)
    
    print("\nCreated 'plotting_examples.py' with sample visualization code!")


if __name__ == "__main__":
    # Generate the CSV files
    result = generate_plotting_csvs()
    
    if result:
        # Create example plotting code
        create_plotting_examples()
        print("\nReady for plotting! Check the generated CSV files and plotting examples.")
    else:
        print("Failed to generate CSV files. Please check your data and try again.")
