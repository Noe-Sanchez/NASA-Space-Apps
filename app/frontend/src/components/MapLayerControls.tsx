import { memo } from "react";
import { type Viewport, type ExtendedLayerVisibility } from "./MapboxMap";

export interface LayerVisibility {
  sharkActivity: boolean;
  sharkPaths: boolean;
  sharkPoints: boolean;
  [key: string]: boolean; // Allow dynamic GIBS layers
}

interface MapLayerControlsProps {
  layersVisible: ExtendedLayerVisibility;
  onToggleLayer: (layer: keyof ExtendedLayerVisibility) => void;
  viewport: Viewport;
  gibsLayers?: Record<
    string,
    { id: string; name: string; description: string }
  >;
}

export const MapLayerControls = memo(function MapLayerControls({
  layersVisible,
  onToggleLayer,
  viewport,
  gibsLayers = {},
}: MapLayerControlsProps) {
  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
      <h3 className="font-bold text-lg mb-3">Map Layers</h3>

      {/* Standard Layers */}
      <div className="space-y-2 mb-4">
        <h4 className="font-semibold text-sm text-gray-600">Shark Layers</h4>
        <LayerToggle
          label="Shark Heatmap"
          checked={layersVisible.sharkActivity}
          onChange={() => onToggleLayer("sharkActivity")}
        />
        <LayerToggle
          label="Shark Paths"
          checked={layersVisible.sharkPaths}
          onChange={() => onToggleLayer("sharkPaths")}
        />
        <LayerToggle
          label="Shark Points"
          checked={layersVisible.sharkPoints}
          onChange={() => onToggleLayer("sharkPoints")}
        />
      </div>

      {/* NASA GIBS Layers */}
      {Object.keys(gibsLayers).length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <h4 className="font-semibold text-sm text-gray-600">
            NASA GIBS Data
          </h4>
          {Object.values(gibsLayers).map((layer) => (
            <LayerToggle
              key={layer.id}
              label={layer.name}
              checked={layersVisible[layer.id] || false}
              onChange={() =>
                onToggleLayer(layer.id as keyof ExtendedLayerVisibility)
              }
              description={layer.description}
            />
          ))}
        </div>
      )}

      {/* Viewport Info */}
      <div className="mt-4 pt-3 border-t text-xs text-gray-500">
        <p>Zoom: {viewport.zoom.toFixed(2)}</p>
        <p>Lat: {viewport.center.lat.toFixed(4)}</p>
        <p>Lng: {viewport.center.lng.toFixed(4)}</p>
      </div>
    </div>
  );
});

function LayerToggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  description?: string;
}) {
  return (
    <label className="flex items-start cursor-pointer hover:bg-gray-50 p-2 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-1 mr-3"
      />
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-800">{label}</span>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
    </label>
  );
}
