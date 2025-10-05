import { fetchOceanCurrentField } from "./windyApi";

export interface CurrentVector {
  lat: number;
  lon: number;
  u: number; // East-West velocity (m/s)
  v: number; // North-South velocity (m/s)
  magnitude: number;
  direction: number; // degrees
}

/**
 * Fetch REAL ocean current data using Windy API
 * This actually works and returns real data
 */
export async function fetchNASAOceanCurrents(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}): Promise<CurrentVector[]> {
  try {
    console.log("🌊 Fetching REAL ocean current data from Windy...");

    // Use your working Windy API
    const currentData = await fetchOceanCurrentField({
      north: bounds.north,
      south: bounds.south,
      east: bounds.east,
      west: bounds.west,
    });

    console.log(`✅ Got ${currentData.length} current data points from Windy`);

    // Convert Windy format to vector format
    const vectors: CurrentVector[] = currentData.map((point) => {
      const u = point.u;
      const v = point.v;
      const magnitude = Math.sqrt(u * u + v * v);
      // Calculate direction in degrees (0° = North, 90° = East)
      const direction = (Math.atan2(u, v) * 180) / Math.PI;

      return {
        lat: point.lat,
        lon: point.lon,
        u,
        v,
        magnitude,
        direction,
      };
    });

    // Filter out very weak currents to reduce clutter
    const filtered = vectors.filter((v) => v.magnitude > 0.05);

    console.log(`✅ Created ${filtered.length} current vectors`);
    return filtered;
  } catch (error) {
    console.error("❌ Error fetching ocean currents:", error);
    return [];
  }
}

/**
 * Convert current vectors to GeoJSON for Mapbox visualization
 */
export function currentVectorsToGeoJSON(vectors: CurrentVector[]) {
  return {
    type: "FeatureCollection",
    features: vectors.map((v) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [v.lon, v.lat],
      },
      properties: {
        u: v.u,
        v: v.v,
        magnitude: v.magnitude,
        direction: v.direction,
        speed: (v.magnitude * 1.94384).toFixed(2), // Convert m/s to knots
      },
    })),
  };
}

/**
 * Create arrow symbols for current vectors
 */
export function createCurrentArrowImage(
  magnitude: number,
  maxMagnitude: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const size = 40;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;
  const centerX = size / 2;
  const centerY = size / 2;

  // Scale arrow size based on magnitude
  const scale = Math.min(magnitude / maxMagnitude, 1);
  const arrowLength = 15 * scale;

  ctx.strokeStyle = getColorForMagnitude(magnitude, maxMagnitude);
  ctx.fillStyle = getColorForMagnitude(magnitude, maxMagnitude);
  ctx.lineWidth = 2;

  // Draw arrow shaft
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + arrowLength / 2);
  ctx.lineTo(centerX, centerY - arrowLength / 2);
  ctx.stroke();

  // Draw arrowhead
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - arrowLength / 2);
  ctx.lineTo(centerX - 4, centerY - arrowLength / 2 + 6);
  ctx.lineTo(centerX + 4, centerY - arrowLength / 2 + 6);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

function getColorForMagnitude(magnitude: number, maxMagnitude: number): string {
  const ratio = magnitude / maxMagnitude;

  if (ratio < 0.2) return "#4575b4"; // Weak - Blue
  if (ratio < 0.4) return "#74add1"; // Light Blue
  if (ratio < 0.6) return "#fee090"; // Yellow
  if (ratio < 0.8) return "#f46d43"; // Orange
  return "#d73027"; // Strong - Red
}
