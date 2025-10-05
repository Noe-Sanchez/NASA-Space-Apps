import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import { OceanParticles } from "@/lib/OceanParticles";
import { fetchOceanCurrentField } from "@/lib/windyApi";
import {
  type SharkHotspot,
  SAMPLE_SHARK_PATH, // Import shark path data
} from "@/lib/sharkData";
import { addWindyMarkers, GULF_SAMPLE_POINTS } from "@/lib/mapHelpers";
import { createSharkPopupHTML } from "@/lib/sharkPopup";
import { getOceanLandGeoJSON } from "@/lib/earthData";
import { MapLayerControls, type LayerVisibility } from "./MapLayerControls";

export interface Viewport {
  center: { lng: number; lat: number };
  zoom: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  bearing: number;
  pitch: number;
}

interface MapboxMapProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  styleUrl?: string;
  className?: string;
  sharkHotspots?: SharkHotspot[];
  onViewportChange?: (viewport: Viewport) => void;
}

// ============= NASA GIBS LAYER CONFIGURATION =============
type GIBSLayerConfig = {
  id: string;
  identifier: string;
  name: string;
  maxLevel: number;
  extension: "jpg" | "png";
  dateString: string;
  opacity: number;
  description: string;
  tileMatrixSet: string;
  epsgProjection: "epsg4326" | "epsg3857";
};

// Define all available GIBS layers
const GIBS_LAYERS: Record<string, GIBSLayerConfig> = {
  seaSurfaceTemp: {
    id: "nasa-sst",
    identifier: "GHRSST_L4_MUR_Sea_Surface_Temperature",
    name: "Sea Surface Temperature",
    maxLevel: 7,
    extension: "png",
    dateString: "2018-07-17",
    opacity: 0.7,
    description: "Daily sea surface temperature data",
    tileMatrixSet: "GoogleMapsCompatible_Level",
    epsgProjection: "epsg3857",
  },
  chlorophyll: {
    id: "nasa-chlorophyll",
    identifier: "VIIRS_NOAA20_Chlorophyll_a",
    name: "Chlorophyll Concentration",
    maxLevel: 7,
    extension: "png",
    dateString: "2018-07-17",
    opacity: 0.7,
    description: "Ocean chlorophyll-a concentration from VIIRS",
    tileMatrixSet: "GoogleMapsCompatible_Level",
    epsgProjection: "epsg3857",
  },
};

// Color palette for shark paths
const SHARK_COLOR_PALETTE = [
  { base: "#ff00a2", light: "#ffc0cb" }, // Pink
  { base: "#00a2ff", light: "#add8e6" }, // Blue
  { base: "#32CD32", light: "#98FB98" }, // LimeGreen
  { base: "#ffA500", light: "#ffdd99" }, // Orange
  { base: "#8a2be2", light: "#e0c4ff" }, // BlueViolet
  { base: "#00ffff", light: "#c4ffff" }, // Cyan
  { base: "#ff4500", light: "#ffb399" }, // OrangeRed
  { base: "#228b22", light: "#aaddaa" }, // ForestGreen
];

// Extended LayerVisibility to include GIBS layers
export interface ExtendedLayerVisibility extends LayerVisibility {
  [key: string]: boolean;
}

export default function MapboxMap({
  lat = 25.9,
  lng = -97.0,
  zoom = 7,
  styleUrl = "mapbox://styles/mapbox/light-v11",
  className = "map h-full w-full",
  onViewportChange,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const particleSystem = useRef<OceanParticles | null>(null);
  const windyMarkers = useRef<mapboxgl.Marker[]>([]);

  const [error, setError] = useState<string | null>(null);

  // Initialize with GIBS layers included
  const [layersVisible, setLayersVisible] = useState<ExtendedLayerVisibility>({
    sharkActivity: false,
    sharkPaths: true, // Controls the lines
    sharkPoints: true, // Controls the points
    // GIBS layers
    "nasa-sst": true,
    "nasa-chlorophyll": false,
  });

  const [viewport, setViewport] = useState<Viewport>({
    center: { lng, lat },
    zoom,
    bounds: { north: 0, south: 0, east: 0, west: 0 },
    bearing: 0,
    pitch: 0,
  });

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    initializeMap();

    return cleanup;
  }, []);

  useEffect(() => {
    if (!map.current) return;
    updateLayerVisibility();
  }, [layersVisible]);

  function initializeMap() {
    const token = import.meta.env.PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      setError("Missing PUBLIC_MAPBOX_TOKEN");
      console.error(
        "Mapbox token is missing. Please add PUBLIC_MAPBOX_TOKEN to your .env file"
      );
      return;
    }

    try {
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: styleUrl,
        center: [lng, lat],
        zoom: zoom,
        projection: "mercator",
        attributionControl: true,
        maxZoom: 6.99,
      });

      addMapControls();
      setupViewportTracking();
      map.current.on("load", handleMapLoad);
    } catch (err) {
      console.error("Error initializing map:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  function addMapControls() {
    if (!map.current) return;

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.current.addControl(
      new mapboxgl.ScaleControl({ unit: "metric" }),
      "bottom-left"
    );
  }

  function setupViewportTracking() {
    if (!map.current) return;

    const updateViewportState = () => {
      if (!map.current) return;

      const center = map.current.getCenter();
      const currentZoom = map.current.getZoom();
      const currentBounds = map.current.getBounds();
      if (!currentBounds) return;

      const newViewport: Viewport = {
        center: { lng: center.lng, lat: center.lat },
        zoom: currentZoom,
        bounds: {
          north: currentBounds.getNorth(),
          south: currentBounds.getSouth(),
          east: currentBounds.getEast(),
          west: currentBounds.getWest(),
        },
        bearing: map.current.getBearing(),
        pitch: map.current.getPitch(),
      };

      setViewport(newViewport);
      onViewportChange?.(newViewport);
    };

    map.current.on("move", updateViewportState);
    map.current.on("zoom", updateViewportState);
    map.current.on("rotate", updateViewportState);
    map.current.on("pitch", updateViewportState);

    updateViewportState();
  }

  async function handleMapLoad() {
    if (!map.current) return;

    const mapBounds = map.current.getBounds();
    if (!mapBounds) return;

    // Add all GIBS layers
    await setupAllGIBSLayers();

    await Promise.all([
      //setupOceanParticles(mapBounds),
      setupSharkHeatmap(),
      setupSharkPaths(), // Add function call to setup paths
      //setupWindyMarkers(),
      //setupOceanLandLayer(mapBounds),
    ]);
  }

  // ============= DYNAMIC GIBS LAYER SETUP =============
  async function setupAllGIBSLayers() {
    if (!map.current) return;

    console.log("🌊 Setting up NASA GIBS layers...");

    // Add each GIBS layer
    for (const [key, config] of Object.entries(GIBS_LAYERS)) {
      await addGIBSLayer(config);
    }

    console.log("✅ All GIBS layers initialized");
  }

  async function addGIBSLayer(config: GIBSLayerConfig) {
    if (!map.current) return;

    console.log(`🔍 Adding layer: ${config.name}`);

    try {
      // Check if layer already exists
      if (map.current.getSource(config.id)) {
        console.log(`⚠️ Layer ${config.id} already exists, skipping`);
        return;
      }

      // Build tile URL based on projection type
      let tileUrl: string;

      if (config.epsgProjection === "epsg4326") {
        // Use WMTS query parameter style for EPSG:4326 layers
        const timeParam = `TIME=${config.dateString}T00:00:00Z`;
        const params = [
          timeParam,
          `layer=${config.identifier}`,
          `style=default`,
          `tilematrixset=${config.tileMatrixSet}`,
          `Service=WMTS`,
          `Request=GetTile`,
          `Version=1.0.0`,
          `Format=image%2F${config.extension}`,
          `TileMatrix={z}`,
          `TileCol={x}`,
          `TileRow={y}`,
        ].join("&");

        // Use gibs-b for EPSG:4326 OSCAR layers
        tileUrl = `https://gibs-b.earthdata.nasa.gov/wmts/${config.epsgProjection}/best/wmts.cgi?${params}`;
      } else {
        // Use REST-style path for Web Mercator (EPSG:3857) layers
        tileUrl = `https://gibs-b.earthdata.nasa.gov/wmts/${config.epsgProjection}/best/${config.identifier}/default/${config.dateString}/${config.tileMatrixSet}${config.maxLevel}/{z}/{y}/{x}.${config.extension}`;
      }

      console.log(`   Tile URL: ${tileUrl}`);

      // Add source with proper tile URL template
      map.current.addSource(config.id, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        scheme: config.epsgProjection === "epsg4326" ? "tms" : "xyz",
        attribution: `<a href="https://earthdata.nasa.gov/gibs">NASA GIBS - ${config.name}</a>`,
        minzoom: 0,
        maxzoom: config.maxLevel,
      });

      // Add layer
      map.current.addLayer({
        id: config.id,
        type: "raster",
        source: config.id,
        paint: {
          "raster-opacity": config.opacity,
          "raster-fade-duration": 300,
        },
        minzoom: 0,
        maxzoom: 22, // Allow Mapbox to oversample for higher zoom levels
        layout: {
          visibility: layersVisible[config.id] ? "visible" : "none",
        },
      });

      console.log(`✅ Added: ${config.name} (maxLevel: ${config.maxLevel})`);

      // Error handling for this specific layer
      map.current.on("error", (e: any) => {
        if (e.sourceId === config.id) {
          console.error(`❌ ${config.name} tile error:`, e);
          console.error(`   URL was: ${tileUrl}`);
        }
      });
    } catch (err) {
      console.error(`❌ Error adding ${config.name}:`, err);
    }
  }

  // ============= SHARK PATHS SETUP =============
  function setupSharkPaths() {
    if (!map.current) return;

    SAMPLE_SHARK_PATH.forEach((shark, sharkIndex) => {
      const pathSourceId = `shark-path-source-${shark.id}`;
      const pathLineLayerId = `shark-path-line-${shark.id}`;
      const pathPointsLayerId = `shark-path-points-${shark.id}`;

      // Assign a color from the palette based on the shark's index
      const color =
        SHARK_COLOR_PALETTE[sharkIndex % SHARK_COLOR_PALETTE.length];

      // 1. Create GeoJSON data from the shark's location history
      const lineCoordinates = shark.location.map((p) => p.geometry.coordinates);

      const pointFeatures = shark.location.map((p, index) => ({
        ...p,
        properties: {
          ...p, // Keep original properties like 'doing'
          sharkName: shark.name,
          sharkSpecies: shark.species,
          point_index: index, // Add index for styling
          is_latest: index === shark.location.length - 1,
        },
      }));

      const geojsonData = {
        type: "FeatureCollection",
        features: [
          // Line feature for the path
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: lineCoordinates,
            },
          },
          // Point features for each location
          ...pointFeatures,
        ],
      };

      // 2. Add the source to the map
      map.current!.addSource(pathSourceId, {
        type: "geojson",
        data: geojsonData as any,
      });

      // 3. Add the line layer for the path
      map.current!.addLayer({
        id: pathLineLayerId,
        type: "line",
        source: pathSourceId,
        paint: {
          "line-color": color.base,
          "line-width": 2,
          "line-opacity": 0.8,
        },
        filter: ["==", "$type", "LineString"], // Only apply to the line feature
      });

      // 4. Add the circle layer for the points
      map.current!.addLayer({
        id: pathPointsLayerId,
        type: "circle",
        source: pathSourceId,
        paint: {
          // Style points based on their index (age)
          "circle-radius": [
            "case",
            ["==", ["get", "is_latest"], true],
            8, // Larger radius for the latest point
            5,
          ],
          "circle-color": [
            "interpolate",
            ["linear"],
            ["get", "point_index"],
            0,
            color.light, // Oldest: light color
            shark.location.length - 1,
            color.base, // Newest: dark color
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
        filter: ["==", "$type", "Point"], // Only apply to point features
      });

      // 5. Add click interaction for the points
      map.current!.on("click", pathPointsLayerId, (e) => {
        if (!map.current || !e.features?.[0]) return;
        const props = e.features[0].properties;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();

        const popupHTML = `
          <div class="p-2 font-sans">
            <h3 class="font-bold text-lg" style="color: ${color.base};">${
          props?.sharkName
        }</h3>
            <p class="text-sm text-gray-700">Species: ${props?.sharkSpecies}</p>
            <p class="text-sm text-gray-700">Activity: ${props?.doing}</p>
            <p class="text-xs text-gray-500">
              Lng: ${coordinates[0].toFixed(4)}, Lat: ${coordinates[1].toFixed(
          4
        )}
            </p>
          </div>
        `;

        new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "250px",
        })
          .setLngLat(coordinates)
          .setHTML(popupHTML)
          .addTo(map.current);
      });

      // Change cursor to pointer on hover
      map.current!.on("mouseenter", pathPointsLayerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "pointer";
      });
      map.current!.on("mouseleave", pathPointsLayerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "";
      });
    });
  }

  /* async function setupOceanParticles(mapBounds: mapboxgl.LngLatBounds) {
    if (!map.current) return;

    const bounds = {
      minLat: mapBounds.getSouth(),
      maxLat: mapBounds.getNorth(),
      minLon: mapBounds.getWest(),
      maxLon: mapBounds.getEast(),
    };

    const container = map.current.getCanvas();
    particleSystem.current = new OceanParticles(
      container.width,
      container.height,
      bounds,
      5000
    );

    particleSystem.current.setMap(map.current);

    console.log("Fetching ocean current data for the visible area...");
    const currentData = await fetchOceanCurrentField({
      north: bounds.maxLat,
      south: bounds.minLat,
      west: bounds.minLon,
      east: bounds.maxLon,
    });

    if (particleSystem.current) {
      console.log(
        "Ocean current data loaded:",
        currentData.length,
        "data points"
      );
      particleSystem.current.setCurrentField(currentData);
    }

    addParticleLayer(bounds);
    startParticleAnimation();
    setupResizeHandler();
  }

  function addParticleLayer(bounds: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }) {
    if (!map.current || !particleSystem.current) return;

    map.current.addSource("ocean-particles", {
      type: "canvas" as any,
      canvas: particleSystem.current.getCanvas(),
      coordinates: [
        [bounds.minLon - 1, bounds.maxLat + 1],
        [bounds.maxLon + 1, bounds.maxLat + 1],
        [bounds.maxLon + 1, bounds.minLat - 1],
        [bounds.minLon - 1, bounds.minLat - 1],
      ],
      animate: true,
    });

    map.current.addLayer({
      id: "ocean-particle-layer",
      type: "raster",
      source: "ocean-particles",
      paint: {
        "raster-opacity": 0.7,
        "raster-fade-duration": 0,
      },
    });
  }

  function startParticleAnimation() {
    const animate = () => {
      if (particleSystem.current && map.current) {
        particleSystem.current.update();
        map.current.triggerRepaint();
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  function setupResizeHandler() {
    if (!map.current) return;

    map.current.on("resize", () => {
      if (particleSystem.current && map.current) {
        const canvas = map.current.getCanvas();
        particleSystem.current.resize(canvas.width, canvas.height);
      }
    });
  } */

  function setupSharkHeatmap() {
    if (!map.current) return;

    // 1. Collect all points from all sharks in SAMPLE_SHARK_PATH
    const allSharkPoints = SAMPLE_SHARK_PATH.flatMap((shark) =>
      shark.location.map((point) => ({
        ...point,
        properties: {
          doing: point.doing,
          intensity: 1.0, // Assign a weight for the heatmap
        },
      }))
    );

    const sharkActivityData = {
      type: "FeatureCollection",
      features: allSharkPoints,
    };

    // 2. Add the GeoJSON source with the collected points
    map.current.addSource("shark-activity", {
      type: "geojson",
      data: sharkActivityData as any,
    });

    // 3. Add the heatmap layer
    map.current.addLayer({
      id: "shark-heatmap",
      type: "heatmap",
      source: "shark-activity",
      paint: {
        // Use the 'intensity' property of each point as its weight
        "heatmap-weight": ["get", "intensity"],
        // Adjust the global intensity of the heatmap
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
        // Color ramp for the heatmap
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0, 0, 0, 0)",
          0.2,
          "rgba(135, 206, 250, 0.4)", // Light Blue
          0.4,
          "rgba(144, 238, 144, 0.5)", // Light Green
          0.6,
          "rgba(255, 255, 153, 0.6)", // Yellow
          0.8,
          "rgba(255, 140, 66, 0.7)", // Orange
          1,
          "rgba(235, 100, 52, 0.8)", // Red
        ],
        // Adjust radius based on zoom level
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 25, 9, 100],
        // Opacity of the entire heatmap layer
        "heatmap-opacity": 0.8,
      },
      layout: {
        // Set initial visibility based on state
        visibility: layersVisible.sharkActivity ? "visible" : "none",
      },
    });

    setupSharkInteractions();
  }

  function setupSharkInteractions() {
    if (!map.current) return;

    map.current.on("click", (e) => {
      if (!map.current) return;

      // Prioritize shark path points. Check if the click was on any of them.
      const sharkPointLayerIds = SAMPLE_SHARK_PATH.map(
        (shark) => `shark-path-points-${shark.id}`
      );
      const pointFeatures = map.current.queryRenderedFeatures(e.point, {
        layers: sharkPointLayerIds,
      });

      // If a point was clicked, its own handler will create a popup, so we do nothing here.
      if (pointFeatures.length > 0) {
        return;
      }

      // If no point was clicked, proceed with the heatmap interaction.
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ["shark-heatmap"],
      });

      if (features.length > 0) {
        const intensity = features[0].properties?.intensity || 0;
        const popupContent = createSharkPopupHTML(intensity);

        new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: "300px",
        })
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map.current);
      }
    });

    map.current.on("mouseenter", "shark-heatmap", () => {
      if (map.current) map.current.getCanvas().style.cursor = "pointer";
    });

    map.current.on("mouseleave", "shark-heatmap", () => {
      if (map.current) map.current.getCanvas().style.cursor = "";
    });
  }

  /* async function setupWindyMarkers() {
    if (!map.current) return;

    try {
      const markers = await addWindyMarkers(map.current, GULF_SAMPLE_POINTS);
      windyMarkers.current = markers;
    } catch (err) {
      console.error("❌ Fatal error in addWindyMarkers:", err);
    }
  }

  async function setupOceanLandLayer(mapBounds: mapboxgl.LngLatBounds) {
    if (!map.current) return;

    const bounds = {
      north: mapBounds.getNorth(),
      south: mapBounds.getSouth(),
      east: mapBounds.getEast(),
      west: mapBounds.getWest(),
    };

    const oceanLandData = getOceanLandGeoJSON(bounds);
    console.log(
      "Ocean/Land data generated:",
      oceanLandData.features.length,
      "points"
    );

    map.current.addSource("ocean-land-data", {
      type: "geojson",
      data: oceanLandData as any,
    });

    map.current.addLayer({
      id: "ocean-layer",
      type: "circle",
      source: "ocean-land-data",
      filter: ["==", ["get", "type"], "ocean"],
      paint: {
        "circle-radius": 4,
        "circle-color": "#0077be",
        "circle-opacity": 0.6,
      },
    });

    map.current.addLayer({
      id: "land-layer",
      type: "circle",
      source: "ocean-land-data",
      filter: ["==", ["get", "type"], "land"],
      paint: {
        "circle-radius": 4,
        "circle-color": "#2d5016",
        "circle-opacity": 0.6,
      },
    });

    setupOceanLandInteractions();
  }

  function setupOceanLandInteractions() {
    if (!map.current) return;

    map.current.on("click", "ocean-layer", (e) => {
      if (!map.current || !e.features?.[0]) return;

      const coordinates = (e.features[0].geometry as any).coordinates.slice();
      const type = e.features[0].properties?.type;

      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(
          `
          <div class="p-2">
            <h3 class="font-bold text-blue-600">🌊 Ocean</h3>
            <p class="text-sm">Type: ${type}</p>
            <p class="text-xs text-gray-600">Lat: ${coordinates[1].toFixed(
              4
            )}, Lng: ${coordinates[0].toFixed(4)}</p>
          </div>
        `
        )
        .addTo(map.current);
    });

    map.current.on("click", "land-layer", (e) => {
      if (!map.current || !e.features?.[0]) return;

      const coordinates = (e.features[0].geometry as any).coordinates.slice();
      const type = e.features[0].properties?.type;

      new mapboxgl.Popup()
        .setLngLat(coordinates)
        .setHTML(
          `
          <div class="p-2">
            <h3 class="font-bold text-green-700">🌍 Land</h3>
            <p class="text-sm">Type: ${type}</p>
            <p class="text-xs text-gray-600">Lat: ${coordinates[1].toFixed(
              4
            )}, Lng: ${coordinates[0].toFixed(4)}</p>
          </div>
        `
        )
        .addTo(map.current);
    });

    ["ocean-layer", "land-layer"].forEach((layerId) => {
      map.current!.on("mouseenter", layerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "pointer";
      });

      map.current!.on("mouseleave", layerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "";
      });
    });
  } */

  function updateLayerVisibility() {
    if (!map.current) return;

    // Update standard layers
    if (map.current.getLayer("shark-heatmap")) {
      map.current.setLayoutProperty(
        "shark-heatmap",
        "visibility",
        layersVisible.sharkActivity ? "visible" : "none"
      );
    }

    // Toggle visibility for each shark path
    SAMPLE_SHARK_PATH.forEach((shark) => {
      const pathLineLayerId = `shark-path-line-${shark.id}`;
      const pathPointsLayerId = `shark-path-points-${shark.id}`;

      if (map.current!.getLayer(pathLineLayerId)) {
        map.current!.setLayoutProperty(
          pathLineLayerId,
          "visibility",
          layersVisible.sharkPaths ? "visible" : "none"
        );
      }
      if (map.current!.getLayer(pathPointsLayerId)) {
        map.current!.setLayoutProperty(
          pathPointsLayerId,
          "visibility",
          layersVisible.sharkPoints ? "visible" : "none"
        );
      }
    });

    if (map.current.getLayer("ocean-particle-layer")) {
      map.current.setLayoutProperty(
        "ocean-particle-layer",
        "visibility",
        layersVisible.oceanParticles ? "visible" : "none"
      );
    }

    if (map.current.getLayer("ocean-layer")) {
      map.current.setLayoutProperty(
        "ocean-layer",
        "visibility",
        layersVisible.oceanLand ? "visible" : "none"
      );
    }

    if (map.current.getLayer("land-layer")) {
      map.current.setLayoutProperty(
        "land-layer",
        "visibility",
        layersVisible.oceanLand ? "visible" : "none"
      );
    }

    // Update GIBS layers dynamically
    Object.values(GIBS_LAYERS).forEach((config) => {
      if (map.current!.getLayer(config.id)) {
        map.current!.setLayoutProperty(
          config.id,
          "visibility",
          layersVisible[config.id] ? "visible" : "none"
        );
      }
    });

    // Update markers
    windyMarkers.current.forEach((marker) => {
      const element = marker.getElement();
      element.style.display = layersVisible.windyData ? "block" : "none";
    });
  }

  function toggleLayer(layer: keyof ExtendedLayerVisibility) {
    setLayersVisible((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  }

  function cleanup() {
    windyMarkers.current.forEach((marker) => marker.remove());
    windyMarkers.current = [];
    particleSystem.current?.destroy();
    particleSystem.current = null;
    map.current?.remove();
    map.current = null;
  }

  if (error) {
    return <div className="p-4 bg-red-500 text-white">Map Error: {error}</div>;
  }

  return (
    <>
      <div
        ref={mapContainer}
        className={className}
        aria-label="interactive map showing shark zones"
        role="region"
      />

      <MapLayerControls
        layersVisible={layersVisible}
        onToggleLayer={toggleLayer}
        viewport={viewport}
        gibsLayers={GIBS_LAYERS}
      />
    </>
  );
}
