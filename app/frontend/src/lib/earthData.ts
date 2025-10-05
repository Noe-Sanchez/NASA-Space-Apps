/**
 * Earth Data utilities for ocean and land classification
 */

export interface EarthPoint {
  lng: number;
  lat: number;
  type: 'ocean' | 'land';
  elevation?: number;
}

export interface OceanLandData {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: {
      type: 'ocean' | 'land';
      elevation?: number;
    };
  }>;
}

/**
 * Generates a grid of points classified as ocean or land
 * Uses simple heuristic: points with elevation <= 0 are ocean
 */
export function generateOceanLandGrid(
  bounds: { north: number; south: number; east: number; west: number },
  gridSize: number = 50
): OceanLandData {
  const features = [];

  const latStep = (bounds.north - bounds.south) / gridSize;
  const lngStep = (bounds.east - bounds.west) / gridSize;

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const lat = bounds.south + i * latStep;
      const lng = bounds.west + j * lngStep;

      // Simple ocean/land classification based on known water bodies
      const isOcean = isPointInOcean(lat, lng);

      features.push({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lng, lat] as [number, number]
        },
        properties: {
          type: isOcean ? 'ocean' as const : 'land' as const,
          elevation: isOcean ? -10 : 10
        }
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Simple heuristic to determine if a point is in ocean
 * For production, you would use NASA's Blue Marble or SRTM data
 */
function isPointInOcean(lat: number, lng: number): boolean {
  // Gulf of Mexico and Atlantic Ocean (for your current map area)
  if (lat >= 18 && lat <= 30 && lng >= -98 && lng <= -80) {
    // Approximate Texas coast
    if (lat >= 25.8 && lat <= 30 && lng >= -97.5 && lng <= -93) {
      return lat < 26.5 || lng < -96;
    }
    return true;
  }

  // Atlantic Ocean
  if (lng >= -80 && lng <= -30 && lat >= 0 && lat <= 45) {
    return true;
  }

  // Pacific Ocean
  if (lng >= -180 && lng <= -100 && lat >= -60 && lat <= 60) {
    return true;
  }

  // Default to land
  return false;
}

/**
 * Fetch NASA SRTM elevation data (placeholder - would need actual API)
 * NASA's Shuttle Radar Topography Mission provides global elevation data
 */
export async function fetchNASAElevationData(
  bounds: { north: number; south: number; east: number; west: number }
): Promise<number[][]> {
  // This would call NASA's Earthdata API
  // For now, return mock data
  console.log('Fetching NASA elevation data for bounds:', bounds);

  // In production, use: https://appeears.earthdatacloud.nasa.gov/
  // or NASA's SRTM data: https://cmr.earthdata.nasa.gov/

  return [];
}

/**
 * Classify a single point as ocean or land
 */
export function classifyPoint(lat: number, lng: number): EarthPoint {
  const isOcean = isPointInOcean(lat, lng);

  return {
    lng,
    lat,
    type: isOcean ? 'ocean' : 'land',
    elevation: isOcean ? -10 : 10
  };
}

/**
 * Get GeoJSON for ocean and land visualization
 */
export function getOceanLandGeoJSON(
  bounds: { north: number; south: number; east: number; west: number }
): OceanLandData {
  return generateOceanLandGrid(bounds, 100);
}
