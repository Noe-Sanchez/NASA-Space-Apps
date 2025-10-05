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

export default function MapboxMap({
  lat = 25.6866,
  lng = -100.3161,
  zoom = 11,
  styleUrl = 'mapbox://styles/mapbox/streets-v12',
  className = 'map h-[480px] w-full rounded-2xl'
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

      const popup = new mapboxgl.Popup({ offset: 16 }).setText('Hello from React!');
      new mapboxgl.Marker({ color: '#1d4ed8' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current);
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
      <h1 className="text-white p-4">Map Component Loaded</h1>
      <div ref={mapContainer} className={className} aria-label="interactive map" role="region" />
    </>
  );
}
