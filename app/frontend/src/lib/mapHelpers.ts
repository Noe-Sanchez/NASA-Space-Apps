import mapboxgl from 'mapbox-gl';
import { fetchWindyData, type WindyForecast } from './windyApi';

export interface SamplePoint {
  lat: number;
  lng: number;
}

export const GULF_SAMPLE_POINTS: SamplePoint[] = [
  { lat: 25.5, lng: -97.0 },
  { lat: 26.0, lng: -97.0 },
  { lat: 26.0, lng: -96.5 },
  { lat: 25.5, lng: -96.5 },
  { lat: 25.8, lng: -97.3 },
  { lat: 26.2, lng: -96.8 }
];

export function createWindyMarkerElement(waveHeight: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'windy-marker';
  el.style.cssText = `
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, rgba(30, 144, 255, 0.9), rgba(0, 119, 204, 0.9));
    border: 3px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 12px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    transition: transform 0.2s;
  `;
  el.textContent = `${waveHeight.toFixed(1)}m`;

  el.addEventListener('mouseenter', () => {
    el.style.transform = 'scale(1.1)';
  });

  el.addEventListener('mouseleave', () => {
    el.style.transform = 'scale(1)';
  });

  return el;
}

export function createWindyPopupHTML(data: WindyForecast, point: SamplePoint): string {
  const waveHeight = data.waves?.[0] ?? 0;
  const wavePeriod = data.wavesPeriod?.[0];
  const waveDirection = data.wavesDirection?.[0];
  const swell1 = data.swell1?.[0];
  const swell2 = data.swell2?.[0];

  return `
    <div style="padding: 16px; font-family: -apple-system, sans-serif; min-width: 220px;">
      <h3 style="margin: 0 0 14px 0; font-size: 16px; color: #1e90ff; font-weight: 600;">🌊 Wave Data</h3>
      <div style="font-size: 14px; color: #333; line-height: 1.6;">
        <p style="margin: 8px 0;">
          <strong>Wave Height:</strong> ${waveHeight.toFixed(2)} m
        </p>
        ${wavePeriod ? `<p style="margin: 8px 0;"><strong>Period:</strong> ${wavePeriod.toFixed(1)} s</p>` : ''}
        ${waveDirection ? `<p style="margin: 8px 0;"><strong>Direction:</strong> ${waveDirection.toFixed(0)}°</p>` : ''}
        ${swell1 ? `<p style="margin: 8px 0;"><strong>Swell 1:</strong> ${swell1.toFixed(2)} m</p>` : ''}
        ${swell2 ? `<p style="margin: 8px 0;"><strong>Swell 2:</strong> ${swell2.toFixed(2)} m</p>` : ''}
      </div>
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #888; font-style: italic; border-top: 1px solid #eee; padding-top: 8px;">
        📍 ${point.lat.toFixed(2)}°N, ${Math.abs(point.lng).toFixed(2)}°W<br/>
        Data from Windy API
      </p>
    </div>
  `;
}

export async function addWindyMarkers(
  map: mapboxgl.Map,
  samplePoints: SamplePoint[]
): Promise<mapboxgl.Marker[]> {
  console.log('=== Starting Windy API Markers ===');
  console.log('API Key configured:', !!import.meta.env.PUBLIC_WINDY_API_KEY);

  const markers: mapboxgl.Marker[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (const point of samplePoints) {
    try {
      console.log(`Fetching Windy data for lat: ${point.lat}, lng: ${point.lng}...`);
      const data = await fetchWindyData(point.lat, point.lng);

      if (!data?.waves || data.waves.length === 0) {
        console.warn(`❌ No wave data for ${point.lat}, ${point.lng}`);
        errorCount++;
        continue;
      }

      const waveHeight = data.waves[0];
      const el = createWindyMarkerElement(waveHeight);
      const popupHTML = createWindyPopupHTML(data, point);

      const popup = new mapboxgl.Popup({
        offset: 30,
        closeButton: true,
        maxWidth: '300px'
      }).setHTML(popupHTML);

      const marker = new mapboxgl.Marker(el)
        .setLngLat([point.lng, point.lat])
        .setPopup(popup)
        .addTo(map);

      markers.push(marker);
      successCount++;
      console.log(`✅ Marker added at ${point.lat}, ${point.lng} with wave height ${waveHeight}m`);
    } catch (error) {
      console.error(`❌ Error processing point ${point.lat}, ${point.lng}:`, error);
      errorCount++;
    }
  }

  console.log(`=== Windy Markers Summary ===`);
  console.log(`Total markers added: ${successCount}/${samplePoints.length}`);
  console.log(`Errors: ${errorCount}`);

  return markers;
}
