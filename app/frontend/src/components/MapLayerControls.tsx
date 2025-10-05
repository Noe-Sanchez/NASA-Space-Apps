import { memo, useState } from "react";
import {
  type Viewport,
  type ExtendedLayerVisibility,
  type SharkActivityCategory,
} from "./MapboxMap";

export interface LayerVisibility {
  sharkActivity: boolean;
  sharkPaths: boolean;
  sharkPoints: boolean;
  [key: string]: boolean;
}

interface MapLayerControlsProps {
  layersVisible: ExtendedLayerVisibility;
  onToggleLayer: (layer: keyof ExtendedLayerVisibility) => void;
  viewport: Viewport;
  gibsLayers?: Record<
    string,
    { id: string; name: string; description: string }
  >;
  activityFilter: SharkActivityCategory;
  onActivityFilterChange: (category: SharkActivityCategory) => void;
}

export const MapLayerControls = memo(function MapLayerControls({
  layersVisible,
  onToggleLayer,
  viewport,
  gibsLayers = {},
  activityFilter,
  onActivityFilterChange,
}: MapLayerControlsProps) {
  const activityCategories: SharkActivityCategory[] = [
    "All",
    "Migrating",
    "Foraging",
  ];

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  const handleGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setShowAnalysis(false);

    try {
      // Extract bounds from viewport
      const bounds = [
        [viewport.bounds.west, viewport.bounds.north], // Upper left corner
        [viewport.bounds.east, viewport.bounds.south], // Lower right corner
      ];

      console.log("🔍 Sending analysis request with bounds:", bounds);

      const response = await fetch("http://localhost:8000/sharks/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bounds: bounds,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("✨ Gemini Analysis Result:", data);

      if (data.error) {
        setAnalysisError(data.error);
      } else {
        setAnalysisResult(data.analysis);
        setShowAnalysis(true);
      }
    } catch (error) {
      console.error("❌ Analysis failed:", error);
      setAnalysisError(
        error instanceof Error ? error.message : "Analysis failed"
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const closeAnalysis = () => {
    setShowAnalysis(false);
    setTimeout(() => setAnalysisResult(null), 300); // Clear after animation
  };

  return (
    <>
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="font-bold text-lg mb-3">Map Layers</h3>

        {/* Activity Filter */}
        <div className="space-y-2 mb-4 pb-3 border-b">
          <h4 className="font-semibold text-sm text-gray-600">
            Filter by Activity
          </h4>
          {activityCategories.map((category) => (
            <label
              key={category}
              className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="radio"
                name="activity-filter"
                value={category}
                checked={activityFilter === category}
                onChange={() => onActivityFilterChange(category)}
                className="mr-3"
              />
              <span className="text-sm font-medium text-gray-800">
                {category}
              </span>
            </label>
          ))}
        </div>

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

        {/* Gemini Analysis Button */}
        <div className="mt-4 pt-3 border-t">
          <button
            onClick={handleGeminiAnalysis}
            disabled={isAnalyzing}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-sm"
          >
            <img src="/gemini.png" alt="Gemini" className="w-5 h-5" />
            <span>
              {isAnalyzing ? "Analyzing..." : "Interpret with Gemini"}
            </span>
          </button>

          {analysisError && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {analysisError}
            </div>
          )}
        </div>
      </div>

      {/* Analysis Result Panel */}
      <div
        className={`fixed bottom-0 left-0 right-0 px-32 pb-8 transition-transform duration-300 ease-out pointer-events-none ${
          showAnalysis ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "50vh" }}
      >
        <div className="relative bg-white rounded-2xl shadow-2xl border-t-2 border-blue-500 p-6 overflow-y-auto h-full pointer-events-auto">
          {/* Close Button */}
          <button
            onClick={closeAnalysis}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close analysis"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-4 pr-8">
            <img src="/gemini.png" alt="Gemini" className="w-6 h-6" />
            <h3 className="font-bold text-lg text-gray-800">Gemini Analysis</h3>
          </div>

          {/* Analysis Text */}
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {analysisResult}
            </p>
          </div>
        </div>
      </div>
    </>
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
