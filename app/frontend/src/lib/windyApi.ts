// Windy API service for fetching wave and ocean current data

export interface WindyForecast {
  lat: number;
  lon: number;
  waves?: number[];
  wavesDirection?: number[];
  wavesPeriod?: number[];
  swell1?: number[];
  swell2?: number[];
  ts?: number[];
}

export interface WindData {
  lat: number;
  lon: number;
  u: number; // horizontal wind component
  v: number; // vertical wind component
}

interface Bounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

const WINDY_API_URL = 'https://api.windy.com/api/point-forecast/v2';
const AVAILABLE_MODELS = ['gfsWave', 'ecmwf', 'gfs'];

export async function fetchWindyData(lat: number, lon: number): Promise<WindyForecast | null> {
  const apiKey = import.meta.env.PUBLIC_WINDY_API_KEY;

  if (!apiKey) {
    console.warn('Windy API key not configured');
    return null;
  }

  for (const model of AVAILABLE_MODELS) {
    try {
      const response = await fetch(WINDY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lon,
          model,
          parameters: ['waves', 'wind'],
          key: apiKey
        })
      });

      if (!response.ok) {
        console.warn(`Windy API with model ${model} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`Windy wave data response for ${lat},${lon} using ${model}:`, data);

      // Try different field name formats
      const waves = data['waves-surface'] || data['waves_height-surface'] || data.waves;

      if (waves && waves.length > 0) {
        return {
          lat,
          lon,
          waves,
          wavesDirection: data['wavesDirection-surface'] || data['waves_direction-surface'],
          wavesPeriod: data['wavesPeriod-surface'] || data['waves_period-surface'],
          swell1: data['swell1-surface'] || data['swell1_height-surface'],
          swell2: data['swell2-surface'] || data['swell2_height-surface'],
          ts: data.ts
        };
      }
    } catch (modelError) {
      console.warn(`Error with model ${model}:`, modelError);
      continue;
    }
  }

  console.error(`No valid wave data found for ${lat},${lon} with any model`);
  return null;
}

export async function fetchOceanCurrentField(bounds: Bounds): Promise<WindData[]> {
  const apiKey = import.meta.env.PUBLIC_WINDY_API_KEY;

  if (!apiKey) {
    console.warn('Windy API key not configured - using simulated ocean currents');
    return generateSimulatedCurrents(bounds);
  }

  const latStep = 0.25;
  const lonStep = 0.25;
  const requests: Promise<WindData>[] = [];

  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lon = bounds.west; lon <= bounds.east; lon += lonStep) {
      requests.push(
        fetchCurrentAtPoint(lat, lon, apiKey)
      );
    }
  }

  console.log(`Fetching ocean current data for ${requests.length} points...`);
  const results = await Promise.all(requests);
  const validResults = results.filter(r => r.u !== 0 || r.v !== 0);

  console.log(`Ocean current data fetched: ${results.length} total, ${validResults.length} with current data`);

  if (validResults.length < 5) {
    console.warn('Insufficient real data, using simulated ocean currents');
    return generateSimulatedCurrents(bounds);
  }

  return results;
}

async function fetchCurrentAtPoint(lat: number, lon: number, apiKey: string): Promise<WindData> {
  try {
    const response = await fetch(WINDY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat,
        lon,
        model: 'gfs',
        parameters: ['currents'],
        levels: ['surface'],
        key: apiKey
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      lat,
      lon,
      u: data['currents_u-surface']?.[0] || 0,
      v: data['currents_v-surface']?.[0] || 0
    };
  } catch (err) {
    console.warn(`Failed to fetch current data for ${lat.toFixed(2)},${lon.toFixed(2)}`);
    return { lat, lon, u: 0, v: 0 };
  }
}

function generateSimulatedCurrents(bounds: Bounds): WindData[] {
  const currents: WindData[] = [];
  const latStep = 0.2;
  const lonStep = 0.2;
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLon = (bounds.west + bounds.east) / 2;

  for (let lat = bounds.south; lat <= bounds.north; lat += latStep) {
    for (let lon = bounds.west; lon <= bounds.east; lon += lonStep) {
      const dx = lon - centerLon;
      const dy = lat - centerLat;
      const angle = Math.atan2(dy, dx);
      const baseSpeed = 0.5;
      const noise = Math.sin(lat * 10 + lon * 10) * 0.2;

      let u = -Math.sin(angle) * baseSpeed + noise;
      let v = Math.cos(angle) * baseSpeed * 0.5 + noise;

      // Add northward component for Loop Current simulation
      if (lon > centerLon && lat < centerLat) {
        v += 0.3;
      }

      currents.push({ lat, lon, u, v });
    }
  }

  console.log('Generated simulated ocean currents:', currents.length, 'points');
  return currents;
}
