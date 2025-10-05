export interface SharkHotspot {
  lng: number;
  lat: number;
  intensity: number;
  radius: number;
}

export const DEFAULT_SHARK_HOTSPOTS: SharkHotspot[] = [
  { lng: -97.2, lat: 25.8, intensity: 0.95, radius: 0.3 },
  { lng: -97.5, lat: 26.1, intensity: 0.90, radius: 0.25 },
  { lng: -96.8, lat: 25.6, intensity: 0.65, radius: 0.2 },
  { lng: -97.7, lat: 25.6, intensity: 0.55, radius: 0.2 },
  { lng: -96.4, lat: 25.95, intensity: 0.25, radius: 0.15 },
  { lng: -97.8, lat: 26.2, intensity: 0.20, radius: 0.15 },
  { lng: -96.3, lat: 25.3, intensity: 0.15, radius: 0.15 },
];

export function generateSharkActivityGrid(hotspots: SharkHotspot[]) {
  const features = [];

  for (let lng = -98.0; lng <= -96.0; lng += 0.05) {
    for (let lat = 25.0; lat <= 26.5; lat += 0.05) {
      let intensity = 0.05; // Base ocean intensity

      // Calculate intensity based on distance to hotspots
      hotspots.forEach(hotspot => {
        const distance = Math.sqrt(
          Math.pow(lng - hotspot.lng, 2) + Math.pow(lat - hotspot.lat, 2)
        );

        if (distance < hotspot.radius) {
          const factor = 1 - (distance / hotspot.radius);
          intensity = Math.max(intensity, hotspot.intensity * factor);
        }
      });

      features.push({
        type: 'Feature',
        properties: { intensity },
        geometry: { type: 'Point', coordinates: [lng, lat] }
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

export function getRiskLevel(intensity: number): { level: string; color: string } {
  if (intensity > 0.7) return { level: 'High', color: '#dc3232' };
  if (intensity > 0.4) return { level: 'Medium', color: '#ffcc66' };
  return { level: 'Low', color: '#87ceeb' };
}

export function getRiskDescription(intensity: number): string {
  if (intensity > 0.7) return 'High shark concentration';
  if (intensity > 0.4) return 'Moderate activity level';
  return 'Safe swimming conditions';
}
