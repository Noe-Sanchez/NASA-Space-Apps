import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { OceanParticles } from "@/lib/OceanParticles";
import { type SharkActivityData, type SharkHotspot } from "@/lib/sharkData";
import { createSharkPopupHTML } from "@/lib/sharkPopup";
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

export type SharkActivityCategory = "All" | "Migrating" | "Foraging";

export default function MapboxMap({
  lat = 0.0,
  lng = 0.0,
  zoom = 0,
  styleUrl = "mapbox://styles/mapbox/light-v11",
  className = "map h-full w-full",
  onViewportChange,
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const particleSystem = useRef<OceanParticles | null>(null);
  const windyMarkers = useRef<mapboxgl.Marker[]>([]);
  const mapLoaded = useRef(false);

  const [sharkData, setSharkData] = useState<SharkActivityData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] =
    useState<SharkActivityCategory>("All");

  // Initialize with GIBS layers included
  const [layersVisible, setLayersVisible] = useState<ExtendedLayerVisibility>({
    sharkActivity: false,
    sharkPaths: true,
    sharkPoints: true,
    "nasa-sst": false,
    "nasa-chlorophyll": false,
  });

  const [viewport, setViewport] = useState<Viewport>({
    center: { lng, lat },
    zoom,
    bounds: { north: 0, south: 0, east: 0, west: 0 },
    bearing: 0,
    pitch: 0,
  });

  // Fetch shark data
  useEffect(() => {
    async function fetchSharkData() {
      try {
        console.log("🔄 Fetching shark data from API...");
        const response = await fetch("http://localhost:8000/sharks");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("📦 RAW API DATA RECEIVED:", data);

        const transformedData: SharkActivityData[] = Object.entries(
          data.sharks
        ).map(([sharkId, pings]) => {
          return {
            id: sharkId,
            location: (pings as any[]).map((ping: any) => ({
              type: "Feature",
              geometry: ping.location,
              properties: {
                ...ping,
              },
            })),
          };
        });

        console.log("✨ TRANSFORMED SHARK DATA:", transformedData);
        setSharkData(transformedData);
      } catch (e) {
        console.error("❌ FAILED TO FETCH SHARK DATA:", e);
        setError(e instanceof Error ? e.message : "Failed to load shark data.");
      }
    }

    fetchSharkData();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    initializeMap();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      windyMarkers.current.forEach((marker) => marker.remove());
      windyMarkers.current = [];
      particleSystem.current?.destroy();
      particleSystem.current = null;
      mapLoaded.current = false;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    updateLayerVisibility();
  }, [layersVisible]);

  // Update layers when activity filter changes
  useEffect(() => {
    if (!map.current || !mapLoaded.current || sharkData.length === 0) return;

    console.log("🔄 Activity filter changed to:", activityFilter);

    // Remove existing shark layers
    removeSharkLayers();

    // Re-add with filtered data
    setupSharkHeatmap();
    setupSharkPaths();
  }, [activityFilter]);

  // Setup shark layers when data arrives
  useEffect(() => {
    if (!map.current || sharkData.length === 0 || !mapLoaded.current) {
      console.log("⏳ Waiting for conditions:", {
        hasMap: !!map.current,
        dataLength: sharkData.length,
        mapLoaded: mapLoaded.current,
      });
      return;
    }

    console.log("✅ All conditions met, setting up shark layers...");
    setupSharkHeatmap();
    setupSharkPaths();
  }, [sharkData, mapLoaded.current]);

  // Helper function to filter shark data by activity
  function getFilteredSharkData(): SharkActivityData[] {
    if (activityFilter === "All") {
      return sharkData;
    }

    return sharkData
      .map((shark) => ({
        ...shark,
        location: shark.location.filter(
          (point) => point.properties.doing === activityFilter
        ),
      }))
      .filter((shark) => shark.location.length > 0); // Remove sharks with no matching points
  }

  // Helper function to remove all shark layers
  function removeSharkLayers() {
    if (!map.current) return;

    sharkData.forEach((shark) => {
      const pathLineLayerId = `shark-path-line-${shark.id}`;
      const pathPointsLayerId = `shark-path-points-${shark.id}`;
      const pathSourceId = `shark-path-source-${shark.id}`;

      if (map.current!.getLayer(pathLineLayerId)) {
        map.current!.removeLayer(pathLineLayerId);
      }
      if (map.current!.getLayer(pathPointsLayerId)) {
        map.current!.removeLayer(pathPointsLayerId);
      }
      if (map.current!.getSource(pathSourceId)) {
        map.current!.removeSource(pathSourceId);
      }
    });

    // Remove heatmap
    if (map.current.getLayer("shark-heatmap")) {
      map.current.removeLayer("shark-heatmap");
    }
    if (map.current.getSource("shark-activity")) {
      map.current.removeSource("shark-activity");
    }
  }

  function initializeMap() {
    const token = import.meta.env.PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      setError("Missing PUBLIC_MAPBOX_TOKEN");
      console.error("Mapbox token is missing");
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
        maxZoom: 22,
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

    console.log("🗺️ Map finished loading");
    mapLoaded.current = true;

    await setupAllGIBSLayers();

    if (sharkData.length > 0) {
      console.log(
        "🦈 Shark data already loaded, setting up layers immediately"
      );
      setupSharkHeatmap();
      setupSharkPaths();
    }
  }

  async function setupAllGIBSLayers() {
    if (!map.current) return;

    console.log("🌊 Setting up NASA GIBS layers...");

    for (const [key, config] of Object.entries(GIBS_LAYERS)) {
      await addGIBSLayer(config);
    }

    console.log("✅ All GIBS layers initialized");
  }

  async function addGIBSLayer(config: GIBSLayerConfig) {
    if (!map.current) return;

    console.log(`🔍 Adding layer: ${config.name}`);

    try {
      if (map.current.getSource(config.id)) {
        console.log(`⚠️ Layer ${config.id} already exists, skipping`);
        return;
      }

      let tileUrl: string;

      if (config.epsgProjection === "epsg4326") {
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

        tileUrl = `https://gibs-b.earthdata.nasa.gov/wmts/${config.epsgProjection}/best/wmts.cgi?${params}`;
      } else {
        tileUrl = `https://gibs-b.earthdata.nasa.gov/wmts/${config.epsgProjection}/best/${config.identifier}/default/${config.dateString}/${config.tileMatrixSet}${config.maxLevel}/{z}/{y}/{x}.${config.extension}`;
      }

      map.current.addSource(config.id, {
        type: "raster",
        tiles: [tileUrl],
        tileSize: 256,
        scheme: config.epsgProjection === "epsg4326" ? "tms" : "xyz",
        attribution: `<a href="https://earthdata.nasa.gov/gibs">NASA GIBS - ${config.name}</a>`,
        minzoom: 0,
        maxzoom: config.maxLevel,
      });

      map.current.addLayer({
        id: config.id,
        type: "raster",
        source: config.id,
        paint: {
          "raster-opacity": config.opacity,
          "raster-fade-duration": 300,
        },
        minzoom: 0,
        maxzoom: 22,
        layout: {
          visibility: layersVisible[config.id] ? "visible" : "none",
        },
      });

      console.log(`✅ Added: ${config.name}`);
    } catch (err) {
      console.error(`❌ Error adding ${config.name}:`, err);
    }
  }

  function setupSharkPaths() {
    if (!map.current) return;

    const filteredData = getFilteredSharkData();
    if (filteredData.length === 0) {
      console.log("⚠️ No shark data matches current filter");
      return;
    }

    console.log(
      "🦈 Setting up shark paths for",
      filteredData.length,
      "sharks with filter:",
      activityFilter
    );

    filteredData.forEach((shark, sharkIndex) => {
      const pathSourceId = `shark-path-source-${shark.id}`;
      const pathLineLayerId = `shark-path-line-${shark.id}`;
      const pathPointsLayerId = `shark-path-points-${shark.id}`;

      const color =
        SHARK_COLOR_PALETTE[sharkIndex % SHARK_COLOR_PALETTE.length];

      const lineCoordinates = shark.location.map((p) => p.geometry.coordinates);

      const pointFeatures = shark.location.map((feature, index) => {
        return {
          ...feature,
          properties: {
            ...feature.properties,
            point_index: index,
            is_latest: index === shark.location.length - 1,
          },
        };
      });

      const geojsonData = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: lineCoordinates,
            },
          },
          ...pointFeatures,
        ],
      };

      try {
        map.current!.addSource(pathSourceId, {
          type: "geojson",
          data: geojsonData as any,
        });

        map.current!.addLayer({
          id: pathLineLayerId,
          type: "line",
          source: pathSourceId,
          paint: {
            "line-color": color.base,
            "line-width": 3,
            "line-opacity": 0.8,
          },
          filter: ["==", "$type", "LineString"],
          layout: {
            visibility: layersVisible.sharkPaths ? "visible" : "none",
          },
        });

        map.current!.addLayer({
          id: pathPointsLayerId,
          type: "circle",
          source: pathSourceId,
          paint: {
            "circle-radius": [
              "case",
              ["==", ["get", "is_latest"], true],
              10,
              6,
            ],
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "point_index"],
              0,
              color.light,
              shark.location.length - 1,
              color.base,
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
          filter: ["==", "$type", "Point"],
          layout: {
            visibility: layersVisible.sharkPoints ? "visible" : "none",
          },
        });

        console.log(`✅ [${shark.id}] Layers added successfully`);
      } catch (err) {
        console.error(
          `❌ FAILED TO ADD SOURCE/LAYER FOR SHARK ${shark.id}:`,
          err
        );
      }

      map.current!.on("click", pathPointsLayerId, (e) => {
        if (!map.current || !e.features?.[0]) return;
        const props = e.features[0].properties;
        const coordinates = (e.features[0].geometry as any).coordinates.slice();

        let propertiesHTML = "";
        if (props) {
          const excludedProps = new Set([
            "point_index",
            "is_latest",
            "location",
          ]);
          for (const [key, value] of Object.entries(props)) {
            if (!excludedProps.has(key)) {
              propertiesHTML += `<p class="text-sm text-gray-700 capitalize">${key}: ${value}</p>`;
            }
          }
        }

        const popupHTML = `
          <div class="p-2 font-sans" style="max-height: 200px; overflow-y: auto;">
            <h3 class="font-bold text-lg" style="color: ${color.base};">
              Shark ID: ${props?.id}
            </h3>
            ${propertiesHTML}
            <p class="text-xs text-gray-500 mt-2">
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

      map.current!.on("mouseenter", pathPointsLayerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "pointer";
      });
      map.current!.on("mouseleave", pathPointsLayerId, () => {
        if (map.current) map.current.getCanvas().style.cursor = "";
      });
    });
  }

  function setupSharkHeatmap() {
    if (!map.current) return;

    const filteredData = getFilteredSharkData();
    if (filteredData.length === 0) {
      console.log("⚠️ No shark data matches current filter for heatmap");
      return;
    }

    console.log("🔥 Setting up shark heatmap with filter:", activityFilter);

    const allSharkPoints = filteredData.flatMap((shark) =>
      shark.location.map((point) => ({
        type: "Feature",
        geometry: point.geometry,
        properties: {
          ...point.properties,
          intensity: 1.0,
        },
      }))
    );

    const sharkActivityData = {
      type: "FeatureCollection",
      features: allSharkPoints,
    };

    map.current.addSource("shark-activity", {
      type: "geojson",
      data: sharkActivityData as any,
    });

    map.current.addLayer({
      id: "shark-heatmap",
      type: "heatmap",
      source: "shark-activity",
      paint: {
        "heatmap-weight": [
          "interpolate",
          ["linear"],
          ["get", "intensity"],
          0,
          0,
          1,
          1,
        ],
        // Reduced intensity for subtler effect
        "heatmap-intensity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.5,
          5,
          0.8,
          9,
          1.2,
        ],
        // Updated color ramp with more granular steps
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(0, 0, 0, 0)",
          0.1,
          "rgba(135, 206, 250, 0.2)", // Very light blue
          0.3,
          "rgba(135, 206, 250, 0.4)", // Light blue
          0.5,
          "rgba(144, 238, 144, 0.5)", // Light green
          0.7,
          "rgba(255, 255, 153, 0.6)", // Yellow
          0.85,
          "rgba(255, 140, 66, 0.7)", // Orange
          1,
          "rgba(235, 100, 52, 0.8)", // Red
        ],
        // Significantly reduced radius for finer grain
        "heatmap-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          8, // Much smaller at low zoom
          3,
          12,
          5,
          18,
          7,
          25,
          9,
          35, // Reduced from 100
        ],
        // Slightly reduced opacity
        "heatmap-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          0,
          0.6,
          5,
          0.7,
          9,
          0.8,
        ],
      },
      layout: {
        visibility: layersVisible.sharkActivity ? "visible" : "none",
      },
    });

    setupSharkInteractions();
  }

  function setupSharkInteractions() {
    if (!map.current) return;

    map.current.on("click", (e) => {
      if (!map.current) return;

      const filteredData = getFilteredSharkData();
      const sharkPointLayerIds = filteredData.map(
        (shark) => `shark-path-points-${shark.id}`
      );
      const pointFeatures = map.current.queryRenderedFeatures(e.point, {
        layers: sharkPointLayerIds,
      });

      if (pointFeatures.length > 0) {
        return;
      }

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

  function updateLayerVisibility() {
    if (!map.current) return;

    if (map.current.getLayer("shark-heatmap")) {
      map.current.setLayoutProperty(
        "shark-heatmap",
        "visibility",
        layersVisible.sharkActivity ? "visible" : "none"
      );
    }

    const filteredData = getFilteredSharkData();
    filteredData.forEach((shark) => {
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

    Object.values(GIBS_LAYERS).forEach((config) => {
      if (map.current!.getLayer(config.id)) {
        map.current!.setLayoutProperty(
          config.id,
          "visibility",
          layersVisible[config.id] ? "visible" : "none"
        );
      }
    });

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
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
      />
    </>
  );
}
