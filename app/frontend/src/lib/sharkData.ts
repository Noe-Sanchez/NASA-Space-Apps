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
  doing: string;
}

export interface SharkActivityData {
  id: string;
  species: string;
  name: string;
  location: SharkActivityPoint[];
}

export const SAMPLE_SHARK_PATH: SharkActivityData[] = [
  {
    id: "6969",
    species: "T-burón",
    name: "Tiburoncin Uh ha ha",
    location: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-97.0, 25.5] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.8, 25.5] },
        doing: "crapping",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.5, 25.6] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.5, 26.0] },
        doing: "shelter",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.7, 26.3] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.6, 27.0] },
        doing: "crapping",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.5, 26.85] },
        doing: "eating",
      },
    ],
  },
  {
    id: "7001",
    species: "Great White",
    name: "Bruce",
    location: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-97.0, 25.8] },
        doing: "traveling",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.9, 25.85] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.8, 25.8] },
        doing: "traveling",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.7, 25.9] },
        doing: "shelter",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.6, 25.85] },
        doing: "eating",
      },
    ],
  },
  {
    id: "7002",
    species: "Tiger Shark",
    name: "Katy",
    location: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.8, 26.2] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.7, 26.25] },
        doing: "crapping",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.6, 26.3] },
        doing: "traveling",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.5, 26.2] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.4, 26.25] },
        doing: "shelter",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.3, 26.3] },
        doing: "eating",
      },
    ],
  },
  {
    id: "7003",
    species: "Hammerhead",
    name: "MC",
    location: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-97.0, 25.4] },
        doing: "shelter",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.9, 25.35] },
        doing: "traveling",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.8, 25.45] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.7, 25.5] },
        doing: "crapping",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-96.6, 25.4] },
        doing: "eating",
      },
    ],
  },
  {
    id: "7004",
    species: "Mako Shark",
    name: "Finny",
    location: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.66, 26.82] },
        doing: "traveling",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.8, 26.9] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.5, 27.0] },
        doing: "shelter",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.4, 26.8] },
        doing: "crapping",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.2, 26.7] },
        doing: "eating",
      },
    ],
  },
  {
    id: "7005",
    species: "Blue Shark",
    name: "Jaw-some",
    location: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.6, 26.85] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.4, 26.95] },
        doing: "traveling",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.2, 26.8] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.5, 26.7] },
        doing: "shelter",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.7, 26.6] },
        doing: "crapping",
      },
    ],
  },
  {
    id: "7006",
    species: "Whale Shark",
    name: "Gentle Giant",
    location: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.7, 26.78] },
        doing: "shelter",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.9, 26.7] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.6, 26.6] },
        doing: "traveling",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.4, 26.75] },
        doing: "eating",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.2, 26.85] },
        doing: "crapping",
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [-114.0, 26.9] },
        doing: "eating",
      },
    ],
  },
];

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
