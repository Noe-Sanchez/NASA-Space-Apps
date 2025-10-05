from tkinter.filedialog import test
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
from datetime import datetime, timezone
from .config import settings
from .types import AnimalPing, LayerRequest
import google.generativeai as genai
import requests
import json
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, Polygon
import os
from pydantic import BaseModel

app = FastAPI()

origins = [
    "http://localhost:4321",  # The origin of your frontend app
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Data Loading with GeoPandas ---
def load_shark_data(file_path: str) -> gpd.GeoDataFrame:
    """
    Loads shark tracking data from a JSON file and converts it into a GeoDataFrame.
    """
    with open(file_path, 'r') as f:
        data = json.load(f)

    records = []
    for shark in data:
        shark_id = shark.get('id')
        for feature in shark.get('location', []):
            properties = feature.get('properties', {})
            geom = feature.get('geometry')
            if not (shark_id and geom and 'coordinates' in geom):
                continue

            record = {
                'shark_id': shark_id,
                'geometry': Point(geom['coordinates']),
                **properties
            }
            records.append(record)

    if not records:
        return gpd.GeoDataFrame()

    gdf = gpd.GeoDataFrame(records, geometry='geometry')
    gdf['datetime'] = pd.to_datetime(gdf['datetime']).dt.tz_localize('UTC')
    gdf.set_crs("EPSG:4326", inplace=True)
    return gdf

# Load data at startup
# Construct an absolute path to the GeoJSON file
script_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(script_dir, 'shark.geojson')
shark_gdf = load_shark_data(file_path)


genai.configure(api_key=settings.GEMINI_API_KEY)

@app.get("/")
def read_root():
    return {"Health": "Ok"}

@app.get("/sharks")
def get_sharks():
    # Convert all results to the desired JSON format
    results = json.loads(shark_gdf.to_json(default=str))['features']

    grouped_sharks = {}
    for feature in results:
        props = feature['properties']
        geom = feature['geometry']
        shark_id = str(props.get("shark_id"))

        if shark_id not in grouped_sharks:
            grouped_sharks[shark_id] = []
        
        ping_entry = {
            "id": shark_id,
            "timestamp": props.get("datetime"),
            "location": geom,
            "doing": props.get("behavior", "Unknown")
        }
        grouped_sharks[shark_id].append(ping_entry)

    return {"sharks": grouped_sharks}
    

class AnalysisRequest(BaseModel):
    bounds: List[List[float]]

@app.post("/sharks/analyze")
def analyze_shark_data(request: AnalysisRequest):
    bounds = request.bounds
    
    if not bounds:
        return {"error": "Please provide bounds."}
    
    if len(bounds) != 2:
        return {"error": "Please provide exactly two bounds (Upper left corner, and Lower right corner)."}
    
    if len(bounds[0]) != 2 or len(bounds[1]) != 2:
        return {"error": "Each bound must contain exactly two coordinates (latitude and longitude)."}
    
    # --- Query with GeoPandas ---
    bounding_box = Polygon([
        (bounds[0][0], bounds[0][1]), 
        (bounds[1][0], bounds[0][1]),
        (bounds[1][0], bounds[1][1]), 
        (bounds[0][0], bounds[1][1]),
        (bounds[0][0], bounds[0][1])
    ])

    spatial_mask = shark_gdf.within(bounding_box)
    
    results_gdf = shark_gdf[spatial_mask]

    if results_gdf.empty:
        return {"error": "No shark data found for the given criteria."}
    
    # Limit to avoid huge prompts
    results_gdf = results_gdf.head(100)
    
    # Convert to a list of dictionaries for the prompt
    results = json.loads(results_gdf.to_json(default=str))['features']
    
    formatted_data = json.dumps(results, indent=2, default=str)

    # --- Create the prompt for Gemini ---
    prompt = f"""
    You are a marine biologist analyzing shark tracking data.
    Based on the following list of shark ping data (in GeoJSON Feature format), provide a concise summary of the overall activity.
    Identify any potential patterns, such as common areas or interesting behaviors inferred from the 'behavior' property.

    Limitations:
    - Only use the provided data; do not assume any external knowledge.
    - Focus on high-level patterns rather than individual entries.
    - Keep the analysis under 100 words.
    - Think fast.
    - Don't mention coordinates or IDs, just a general aspect.
    - Just give the response in plain text, no JSON or markdown formatting.

    Data:
    {formatted_data}

    Analysis:
    """

    # --- Call the Gemini API ---
    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        
        return {"analysis": response.text}
    
    except Exception as e:
        return {"error": f"Failed to get analysis from Gemini: {str(e)}"}


@app.get("/layer")
def get_layer(
  layer_request: LayerRequest
):
    if layer_request.layer not in AVAILABLE_LAYERS:
        return {"error": f"Layer '{layer_request.layer}' is not available. Available layers: {', '.join(AVAILABLE_LAYERS)}"}  

    # This endpoint still uses a DB connection.
    # If you want to change this, you'll need to provide the data source.
    # For now, I will comment out the database logic.
    # db = client['layers']
    # collection = db[layer_request.layer]
    # layer_data = list(collection.find())

    # return {"layer": layer_request.layer, "data": layer_data}
    return {"error": "Layer data source is not configured for file-based access."}


@app.post("/animal/ping")
def new_animal_entry(ping_data: AnimalPing):
    # This endpoint was for writing data. With a file-based approach,
    # appending to the JSON file and reloading the GeoDataFrame would be complex
    # and not ideal for a running server.
    # I will disable the data writing part.
    current_datetime = datetime.now(timezone.utc)

    # ! The logic to append to the JSON file and reload the GDF is not implemented.
    # ! This would require careful handling of file locks to prevent race conditions.

    return {
        "status": "New animal entry received (not saved)",
        "animal": {
            "id": ping_data.id,
            "timestamp": current_datetime,
            "temp": ping_data.temp,
            "pressure": ping_data.pressure,
            "GPS": {
                "lat": ping_data.GPS.lat,
                "lon": ping_data.GPS.lon,
                "alt": ping_data.GPS.alt
            },
            "q": {
                "x": ping_data.q.x,
                "y": ping_data.q.y,
                "z": ping_data.q.z,
                "w": ping_data.q.w
            },
            "doing": "Exploring (from model)"
        }
    }
