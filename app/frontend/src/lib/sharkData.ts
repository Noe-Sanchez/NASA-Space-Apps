export interface SharkHotspot {
  lng: number;
  lat: number;
  intensity: number;
  radius: number;
}

export interface SharkActivityPoint {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    [key: string]: any; // To hold all other properties from the API
  };
}

export interface SharkActivityData {
  id: string;
  location: SharkActivityPoint[];
}

// The SAMPLE_SHARK_PATH constant is no longer needed and can be removed.
// For now, I will leave it commented out in case you need it for testing.
/*
export const SAMPLE_SHARK_PATH: SharkActivityData[] = [
  ...
];
*/

export function getRiskLevel(intensity: number): {
  level: string;
  color: string;
} {
  if (intensity > 0.7) return { level: "High", color: "#dc3232" };
  if (intensity > 0.4) return { level: "Medium", color: "#ffcc66" };
  return { level: "Low", color: "#87ceeb" };
}

export function getRiskDescription(intensity: number): string {
  if (intensity > 0.7) return "High shark concentration";
  if (intensity > 0.4) return "Moderate activity level";
  return "Safe swimming conditions";
}
