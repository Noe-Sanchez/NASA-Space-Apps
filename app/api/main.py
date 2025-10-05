from fastapi import FastAPI
from typing import List, Dict
import pymongo
from pymongo.server_api import ServerApi
from datetime import datetime, timezone
from .config import settings
from .types import AnimalPing, LayerRequest
import google.generativeai as genai
import requests
import json


app = FastAPI()

## client = pymongo.MongoClient(settings.database_url, server_api=ServerApi('1'))

genai.configure(api_key=settings.GEMINI_API_KEY)

AVAILABLE_LAYERS = [
    "layer1", 
    "layer2", 
    "layer3"
  ]

@app.get("/")
def read_root():
    return {"Health": "Ok"}

@app.get("/sharks")
def get_sharks(
  bounds: str = None,
  dates: str = None,
  test: bool = False
):

    if not bounds or not dates:
        return {"error": "Please provide both bounds and dates."}
    
    try:
        bounds = json.loads(bounds)
        dates = json.loads(dates)
    except json.JSONDecodeError:
        return {"error": "Invalid format for 'bounds' or 'dates'. They must be valid JSON strings."}


    if len(dates) != 2:
        return {"error": "Please provide exactly two dates as ISO format."}
    
    if len(bounds) != 2:
        return {"error": "Please provide exactly two bounds (Upper left corner, and Lower right corner)."}
    
    if len(bounds[0]) != 2 or len(bounds[1]) != 2:
        return {"error": "Each bound must contain exactly two coordinates (latitude and longitude)."}
    
    try:
        start_date = datetime.fromisoformat(dates[0]).astimezone(timezone.utc)
        end_date = datetime.fromisoformat(dates[1]).astimezone(timezone.utc)
    except ValueError:
        return {"error": "Invalid date format. Please use ISO 8601 format."}
    
    if test:
        return {
            "bounds": bounds,
            "dates": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
    
    db = client['sharks'] # ! Replace with db name
    collection = db['sharks_locations'] # ! Replace with collection name

    query = {  # Queries for points within the specified bounding box
      "timestamp": {
          "$gte": start_date,
          "$lte": end_date
      },
      "location": {
        "$geoWithin": {
            "$geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [bounds[0][0], bounds[0][1]],
                    [bounds[1][0], bounds[0][1]],
                    [bounds[1][0], bounds[1][1]],
                    [bounds[0][0], bounds[1][1]],
                    [bounds[0][0], bounds[0][1]]
                ]],
            },
        },
      },
    }

    results = list(collection.find(query)) # If needed specify limit here
    grouped_sharks = {}

    for result in results:
        shark_id = str(result.get("id"))
        if shark_id not in grouped_sharks:
            grouped_sharks[shark_id] = []
        
        ping_entry = {
            "id": result.get("id"),
            "timestamp": result.get("timestamp"),
            "location": result.get("location"),
            "doing": result.get("doing")
        }
        grouped_sharks[shark_id].append(ping_entry)

    return {"sharks": grouped_sharks}


@app.get("/sharks/{shark_id}")
def get_shark(shark_id: str, test: bool = False):
    
    if test:
        return {"shark_id": shark_id}

    db = client['sharks'] # ! Replace with db name
    collection = db['sharks_info'] # ! Replace with collection name

    shark = collection.find_one({"id": shark_id})

    if shark:
        shark['_id'] = str(shark['_id'])  # Convert ObjectId to string for JSON serialization
        return {"shark": shark}
    else:
        return {"error": "Shark not found"}
    

@app.post("/sharks/analyze")
def analyze_shark_data(
  bounds: List[List[float]],
  dates: List[str],
  test: bool
):
    if not bounds or not dates:
        return {"error": "Please provide both bounds and dates."}
    
    if len(dates) != 2:
        return {"error": "Please provide exactly two dates as ISO format."}
    
    if len(bounds) != 2:
        return {"error": "Please provide exactly two bounds (Upper left corner, and Lower right corner)."}
    
    if len(bounds[0]) != 2 or len(bounds[1]) != 2:
        return {"error": "Each bound must contain exactly two coordinates (latitude and longitude)."}
    
    try:
        start_date = datetime.fromisoformat(dates[0]).astimezone(timezone.utc)
        end_date = datetime.fromisoformat(dates[1]).astimezone(timezone.utc)
    except ValueError:
        return {"error": "Invalid date format. Please use ISO 8601 format."}
    

    if not test:
        db = client['sharks']
        collection = db['sharks_locations']

        query = {
          "timestamp": {"$gte": start_date, "$lte": end_date},
          "location": {
            "$geoWithin": {
                "$geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [bounds[0][0], bounds[0][1]], [bounds[1][0], bounds[0][1]],
                        [bounds[1][0], bounds[1][1]], [bounds[0][0], bounds[1][1]],
                        [bounds[0][0], bounds[0][1]]
                    ]],
                },
            },
          },
        }

        results = list(collection.find(query, {"_id": 0}).limit(100)) # Limit to avoid huge prompts

        if not results:
            return {"error": "No shark data found for the given criteria."}
    else:
        results = []
    
    # We get the raw data from the database
    

    formatted_data = json.dumps(results, indent=2, default=str)

    # --- 3. Create the prompt for Gemini ---
    prompt = f"""
    You are a marine biologist analyzing shark tracking data.
    Based on the following list of shark ping data, provide a concise summary of the overall activity.
    Identify any potential patterns, such as common areas or interesting behaviors inferred from the 'doing' field.

    Limitations:
    - Only use the provided data; do not assume any external knowledge.
    - Focus on high-level patterns rather than individual entries.
    - Keep the analysis under 200 words.

    Data:
    {formatted_data}

    Analysis:
    """

    # --- 4. Call the Gemini API ---
    try:
        model = genai.GenerativeModel('gemini-2.5-flash') # Or another suitable model
        response = model.generate_content(prompt)
        
        # --- 5. Return the result ---
        return {"analysis": response.text}
    
    except Exception as e:
        return {"error": f"Failed to get analysis from Gemini: {str(e)}"}


@app.get("/layer")
def get_layer(
  layer_request: LayerRequest
):
    if layer_request.layer not in AVAILABLE_LAYERS:
        return {"error": f"Layer '{layer_request.layer}' is not available. Available layers: {', '.join(AVAILABLE_LAYERS)}"}  

    db = client['layers']
    collection = db[layer_request.layer]

    layer_data = list(collection.find())

    return {"layer": layer_request.layer, "data": layer_data}


@app.post("/animal/ping")
def new_animal_entry(ping_data: AnimalPing):
    current_datetime = datetime.now(timezone.utc)

    db = client['sharks'] # ! Replace with db name
    collection = db['sharks_locations'] # ! Replace with collection name

    # ! Add the calculations for the "doing" field here
    # ! Do a request to the server

    # response = requests.post(settings.MODEL_SERVER, json={
    #     "timestamp": current_datetime.isoformat(),
    #     "temp": ping_data.temp,
    #     "pressure": ping_data.pressure,
    #     "lat": ping_data.GPS.lat,
    #     "lon": ping_data.GPS.lon,
    #     "alt": ping_data.GPS.alt,
    #     "x": ping_data.q.x,
    #     "y": ping_data.q.y,
    #     "z": ping_data.q.z,
    #     "w": ping_data.q.w
    # })
    # doing = response.json().get("doing", "Unknown")

    collection.insert_one({
        "id": 6969,
        "timestamp": current_datetime,
        "temp": ping_data.temp,
        "pressure": ping_data.pressure,
        "location": {
            "type": "Point",
            "coordinates": [ping_data.GPS.lon, ping_data.GPS.lat, ping_data.GPS.alt]
        },
        "q": {
            "x": ping_data.q.x,
            "y": ping_data.q.y,
            "z": ping_data.q.z,
            "w": ping_data.q.w
        },
        "doing": "Exploring"
    })

    return {
        "status": "New animal entry recorded",
        "animal": {
            "id": 6969,
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
            "doing": "Exploring"
        }
    }
    