import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

import { OceanParticles } from '@/lib/OceanParticles';
import { fetchOceanCurrentField } from '@/lib/windyApi';
import { DEFAULT_SHARK_HOTSPOTS, generateSharkActivityGrid, type SharkHotspot } from '@/lib/sharkData';
import { addWindyMarkers, GULF_SAMPLE_POINTS } from '@/lib/mapHelpers';
import { createSharkPopupHTML } from '@/lib/sharkPopup';
import { MapLayerControls, type LayerVisibility } from './MapLayerControls';

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

export default function MapboxMap({
  lat = 25.9,
  lng = -97.0,
  zoom = 7,
  styleUrl = 'mapbox://styles/mapbox/light-v11',
  className = 'map h-full w-full',
  sharkHotspots = DEFAULT_SHARK_HOTSPOTS,
  onViewportChange
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const particleSystem = useRef<OceanParticles | null>(null);
  const windyMarkers = useRef<mapboxgl.Marker[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [layersVisible, setLayersVisible] = useState<LayerVisibility>({
    sharkActivity: true,
    oceanParticles: true,
    windyData: true
  });
  const [viewport, setViewport] = useState<Viewport>({
    center: { lng, lat },
    zoom,
    bounds: { north: 0, south: 0, east: 0, west: 0 },
    bearing: 0,
    pitch: 0
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
      setError('Missing PUBLIC_MAPBOX_TOKEN');
      console.error('Mapbox token is missing. Please add PUBLIC_MAPBOX_TOKEN to your .env file');
      return;
    }

    try {
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: styleUrl,
        center: [lng, lat],
        zoom: zoom,
        attributionControl: true
      });

      addMapControls();
      setupViewportTracking();
      map.current.on('load', handleMapLoad);
    } catch (err) {
      console.error('Error initializing map:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  function addMapControls() {
    if (!map.current) return;

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
    map.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
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
          west: currentBounds.getWest()
        },
        bearing: map.current.getBearing(),
        pitch: map.current.getPitch()
      };

      setViewport(newViewport);
      onViewportChange?.(newViewport);
    };

    map.current.on('move', updateViewportState);
    map.current.on('zoom', updateViewportState);
    map.current.on('rotate', updateViewportState);
    map.current.on('pitch', updateViewportState);

    updateViewportState();
  }

  async function handleMapLoad() {
    if (!map.current) return;

    const mapBounds = map.current.getBounds();
    if (!mapBounds) return;

    await Promise.all([
      setupOceanParticles(mapBounds),
      setupSharkHeatmap(),
      setupWindyMarkers()
    ]);
  }

  async function setupOceanParticles(mapBounds: mapboxgl.LngLatBounds) {
    if (!map.current) return;

    const bounds = {
      minLat: mapBounds.getSouth(),
      maxLat: mapBounds.getNorth(),
      minLon: mapBounds.getWest(),
      maxLon: mapBounds.getEast()
    };

    const container = map.current.getCanvas();
    particleSystem.current = new OceanParticles(
      container.width,
      container.height,
      bounds,
      5000
    );

    particleSystem.current.setMap(map.current);

    // Fetch ocean current data
    console.log('Fetching ocean current data for the visible area...');
    const currentData = await fetchOceanCurrentField({
      north: bounds.maxLat,
      south: bounds.minLat,
      west: bounds.minLon,
      east: bounds.maxLon
    });

    if (particleSystem.current) {
      console.log('Ocean current data loaded:', currentData.length, 'data points');
      particleSystem.current.setCurrentField(currentData);
    }

    addParticleLayer(bounds);
    startParticleAnimation();
    setupResizeHandler();
  }

  function addParticleLayer(bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
    if (!map.current || !particleSystem.current) return;

    map.current.addSource('ocean-particles', {
      type: 'canvas' as any,
      canvas: particleSystem.current.getCanvas(),
      coordinates: [
        [bounds.minLon - 1, bounds.maxLat + 1],
        [bounds.maxLon + 1, bounds.maxLat + 1],
        [bounds.maxLon + 1, bounds.minLat - 1],
        [bounds.minLon - 1, bounds.minLat - 1]
      ],
      animate: true
    });

    map.current.addLayer({
      id: 'ocean-particle-layer',
      type: 'raster',
      source: 'ocean-particles',
      paint: {
        'raster-opacity': 0.7,
        'raster-fade-duration': 0
      }
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

    map.current.on('resize', () => {
      if (particleSystem.current && map.current) {
        const canvas = map.current.getCanvas();
        particleSystem.current.resize(canvas.width, canvas.height);
      }
    });
  }

  function setupSharkHeatmap() {
    if (!map.current) return;

    const sharkActivityData = generateSharkActivityGrid(sharkHotspots);

    map.current.addSource('shark-activity', {
      type: 'geojson',
      data: sharkActivityData as any
    });

    map.current.addLayer({
      id: 'shark-heatmap',
      type: 'heatmap',
      source: 'shark-activity',
      paint: {
        'heatmap-weight': ['get', 'intensity'],
        'heatmap-intensity': 1.2,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(0, 0, 0, 0)',
          0.01, 'rgba(173, 216, 230, 0)',
          0.1, 'rgba(135, 206, 250, 0.35)',
          0.2, 'rgba(100, 200, 255, 0.45)',
          0.35, 'rgba(144, 238, 144, 0.55)',
          0.5, 'rgba(255, 255, 153, 0.65)',
          0.65, 'rgba(255, 204, 102, 0.75)',
          0.8, 'rgba(255, 140, 66, 0.85)',
          0.9, 'rgba(235, 100, 52, 0.9)',
          1, 'rgba(200, 50, 50, 0.95)'
        ],
        'heatmap-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4, 15,
          7, 35,
          10, 60
        ],
        'heatmap-opacity': 0.75
      }
    });

    setupSharkInteractions();
  }

  function setupSharkInteractions() {
    if (!map.current) return;

    map.current.on('click', (e) => {
      if (!map.current) return;

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['shark-heatmap']
      });

      if (features.length > 0) {
        const intensity = features[0].properties?.intensity || 0;
        const popupContent = createSharkPopupHTML(intensity);

        new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: '300px'
        })
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map.current);
      }
    });

    map.current.on('mouseenter', 'shark-heatmap', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'shark-heatmap', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });
  }

  async function setupWindyMarkers() {
    if (!map.current) return;

    try {
      const markers = await addWindyMarkers(map.current, GULF_SAMPLE_POINTS);
      windyMarkers.current = markers;
    } catch (err) {
      console.error('❌ Fatal error in addWindyMarkers:', err);
    }
  }

  function updateLayerVisibility() {
    if (!map.current) return;

    if (map.current.getLayer('shark-heatmap')) {
      map.current.setLayoutProperty(
        'shark-heatmap',
        'visibility',
        layersVisible.sharkActivity ? 'visible' : 'none'
      );
    }

    if (map.current.getLayer('ocean-particle-layer')) {
      map.current.setLayoutProperty(
        'ocean-particle-layer',
        'visibility',
        layersVisible.oceanParticles ? 'visible' : 'none'
      );
    }

    windyMarkers.current.forEach(marker => {
      const element = marker.getElement();
      element.style.display = layersVisible.windyData ? 'block' : 'none';
    });
  }

  function toggleLayer(layer: keyof LayerVisibility) {
    setLayersVisible(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  }

  function cleanup() {
    windyMarkers.current.forEach(marker => marker.remove());
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
      />
    </>
  );
}
