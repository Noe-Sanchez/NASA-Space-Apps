import { memo } from 'react';

export interface LayerVisibility {
  sharkActivity: boolean;
  oceanParticles: boolean;
  windyData: boolean;
  oceanLand: boolean;
}

interface MapLayerControlsProps {
  layersVisible: LayerVisibility;
  onToggleLayer: (layer: keyof LayerVisibility) => void;
  viewport: {
    center: { lng: number; lat: number };
    zoom: number;
  };
}

export const MapLayerControls = memo(function MapLayerControls({
  layersVisible,
  onToggleLayer,
  viewport
}: MapLayerControlsProps) {
  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10 max-w-xs">
      <h3 className="text-sm font-semibold mb-2 text-gray-800">Map Layers</h3>

      <div className="space-y-2">
        <LayerToggle
          checked={layersVisible.sharkActivity}
          onChange={() => onToggleLayer('sharkActivity')}
          label="🦈 Shark Activity Heatmap"
        />

        <LayerToggle
          checked={layersVisible.oceanParticles}
          onChange={() => onToggleLayer('oceanParticles')}
          label="💧 Ocean Currents"
        />

        <LayerToggle
          checked={layersVisible.windyData}
          onChange={() => onToggleLayer('windyData')}
          label="🌊 Wave Data (Windy)"
        />

        <LayerToggle
          checked={layersVisible.oceanLand}
          onChange={() => onToggleLayer('oceanLand')}
          label="🌍 Ocean/Land Classification"
        />
      </div>

      <ViewportInfo viewport={viewport} />
    </div>
  );
});

interface LayerToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

const LayerToggle = memo(function LayerToggle({ checked, onChange, label }: LayerToggleProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
});

interface ViewportInfoProps {
  viewport: {
    center: { lng: number; lat: number };
    zoom: number;
  };
}

const ViewportInfo = memo(function ViewportInfo({ viewport }: ViewportInfoProps) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <h4 className="text-xs font-semibold text-gray-600 mb-1">Current View</h4>
      <div className="text-xs text-gray-500 space-y-0.5">
        <div>Lat: {viewport.center.lat.toFixed(4)}</div>
        <div>Lng: {viewport.center.lng.toFixed(4)}</div>
        <div>Zoom: {viewport.zoom.toFixed(2)}</div>
      </div>
    </div>
  );
});
