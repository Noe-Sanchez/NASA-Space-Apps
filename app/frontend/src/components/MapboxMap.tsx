import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapboxMapProps {
  lat?: number;
  lng?: number;
  zoom?: number;
  styleUrl?: string;
  className?: string;
}

// Generate dense grid of shark activity data points for smooth raster-like visualization
const generateSharkActivityGrid = () => {
  const features = [];

  // Define hotspot centers with their intensity
  const hotspots = [
    { lng: -97.2, lat: 25.8, intensity: 0.95, radius: 0.3 },
    { lng: -97.5, lat: 26.1, intensity: 0.90, radius: 0.25 },
    { lng: -96.8, lat: 25.6, intensity: 0.65, radius: 0.2 },
    { lng: -97.7, lat: 25.6, intensity: 0.55, radius: 0.2 },
    { lng: -96.4, lat: 25.95, intensity: 0.25, radius: 0.15 },
    { lng: -97.8, lat: 26.2, intensity: 0.20, radius: 0.15 },
    { lng: -96.3, lat: 25.3, intensity: 0.15, radius: 0.15 },
  ];

  // Generate a dense grid of points
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
};

const sharkActivityData = generateSharkActivityGrid();

export default function MapboxMap({
  lat = 25.9,
  lng = -97.0,
  zoom = 7,
  styleUrl = 'mapbox://styles/mapbox/light-v11',
  className = 'map h-full w-full'
}: MapboxMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Initialize map only once

    try {
      const token = import.meta.env.PUBLIC_MAPBOX_TOKEN;

      if (!token) {
        setError('Missing PUBLIC_MAPBOX_TOKEN');
        console.error('Mapbox token is missing. Please add PUBLIC_MAPBOX_TOKEN to your .env file');
        return;
      }

      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: [lng, lat],
        zoom: zoom,
        attributionControl: true
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      map.current.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      // Add shark activity heatmap when map loads
      map.current.on('load', () => {
        if (!map.current) return;

        // Add shark activity data source
        map.current.addSource('shark-activity', {
          type: 'geojson',
          data: sharkActivityData as any
        });

        // Add smooth weather-style heatmap layer with refined colors
        map.current.addLayer({
          id: 'shark-heatmap',
          type: 'heatmap',
          source: 'shark-activity',
          paint: {
            // Weight points by intensity
            'heatmap-weight': ['get', 'intensity'],

            // Consistent intensity for smooth blending
            'heatmap-intensity': 1.2,

            // Weather map color scheme matching the reference image
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0, 0, 0, 0)',              // transparent
              0.01, 'rgba(173, 216, 230, 0)',     // very light blue (transparent transition)
              0.1, 'rgba(135, 206, 250, 0.35)',   // light sky blue
              0.2, 'rgba(100, 200, 255, 0.45)',   // lighter blue
              0.35, 'rgba(144, 238, 144, 0.55)',  // light green
              0.5, 'rgba(255, 255, 153, 0.65)',   // pale yellow
              0.65, 'rgba(255, 204, 102, 0.75)',  // light orange
              0.8, 'rgba(255, 140, 66, 0.85)',    // orange
              0.9, 'rgba(235, 100, 52, 0.9)',     // dark orange/red
              1, 'rgba(200, 50, 50, 0.95)'        // deep red
            ],

            // Larger radius for smoother weather-map effect
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              4, 15,
              7, 35,
              10, 60
            ],

            // High opacity for visibility
            'heatmap-opacity': 0.75
          }
        });

        // Add interactive info on click
        map.current.on('click', (e) => {
          if (!map.current) return;

          // Query features at click point
          const features = map.current.queryRenderedFeatures(e.point, {
            layers: ['shark-heatmap']
          });

          if (features.length > 0) {
            const intensity = features[0].properties?.intensity || 0;
            const riskLevel = intensity > 0.7 ? 'High' : intensity > 0.4 ? 'Medium' : 'Low';
            const color = intensity > 0.7 ? '#dc3232' : intensity > 0.4 ? '#ffcc66' : '#87ceeb';

            const popupContent = `
              <div style="padding: 14px; min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: rgba(255,255,255,0.98); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <h3 style="margin: 0 0 10px 0; font-weight: 600; color: #333; font-size: 15px; display: flex; align-items: center; gap: 6px;">
                  🦈 Shark Activity
                </h3>
                <div style="background: linear-gradient(135deg, ${color}15, ${color}08); padding: 10px; border-radius: 6px; border-left: 3px solid ${color}; margin-bottom: 8px;">
                  <p style="margin: 0; font-size: 13px; color: #555;"><strong style="color: #333;">Risk:</strong> <span style="color: ${color}; font-weight: 600;">${riskLevel}</span></p>
                  <p style="margin: 6px 0 0 0; font-size: 13px; color: #555;"><strong style="color: #333;">Activity:</strong> ${(intensity * 100).toFixed(0)}%</p>
                </div>
                <p style="margin: 0; font-size: 11px; color: #888; font-style: italic;">
                  ${intensity > 0.7 ? 'High shark concentration' :
                    intensity > 0.4 ? 'Moderate activity level' :
                    'Safe swimming conditions'}
                </p>
              </div>
            `;

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

        // Change cursor on hover
        map.current.on('mouseenter', 'shark-heatmap', () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current.on('mouseleave', 'shark-heatmap', () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });
      });

    } catch (err) {
      console.error('Error initializing map:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  if (error) {
    return <div className="p-4 bg-red-500 text-white">Map Error: {error}</div>;
  }

  return (
    <>
      <div ref={mapContainer} className={className} aria-label="interactive map showing shark zones" role="region" />
    </>
  );
}
