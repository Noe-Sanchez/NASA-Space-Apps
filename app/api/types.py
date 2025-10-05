from pydantic import BaseModel

class GPSModel(BaseModel):
    lat: float
    lon: float
    alt: float

class QModel(BaseModel):
    x: float
    y: float
    z: float
    w: float

class AnimalPing(BaseModel):
    id: int
    temp: float
    pressure: float
    GPS: GPSModel
    q: QModel

class LayerRequest(BaseModel):
    layer: str