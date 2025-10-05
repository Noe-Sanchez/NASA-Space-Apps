#!/usr/bin/env python3
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
    
    export_df['is_foraging'] = (export_df['behavior'] == 'Foraging').astype(int)
    export_df['is_migrating'] = (export_df['behavior'] == 'Migrating').astype(int)
    export_df['confidence'] = 1 - export_df['state_uncertainty']
    
    export_df['high_confidence'] = (export_df['confidence'] >= 0.7).astype(int)
    export_df['speed_category'] = pd.cut(export_df['speed_km_day'], 
                                       bins=[0, 50, 150, 300, 2000], 
                                       labels=['Low', 'Medium', 'High', 'Very_High'])
    
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
    
    export_df.to_csv(output_filename, index=False)
    
    print(f"Exported {len(export_df)} observations to {output_filename}")
    
    return output_filename


def generate_plotting_csvs():
    """
    Main function to generate CSV file for plotting foraging areas.
    """
    try:
        df = load_preprocessed_data()
        
        if df is None:
            print("Error: Could not load preprocessed data!")
            print("Please run 'python preprocess_data.py' first.")
            return None
        
        df_enhanced = enhanced_train_hmm(df)
        
        detailed_file = export_foraging_areas_csv(df_enhanced, "shark_foraging_areas_detailed.csv")
        
        
        print(f"CSV files created: {detailed_file}")
        
        return detailed_file
        
    except Exception as e:
        print(f"Error generating CSV files: {e}")
        import traceback
        traceback.print_exc()
        return None



if __name__ == "__main__":
    result = generate_plotting_csvs()
    
    if result:
        print("Generated CSV file.")
    else:
        print("Failed to generate CSV file. Please check your data and try again.")
