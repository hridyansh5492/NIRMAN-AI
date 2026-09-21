import React, { useState } from 'react';
import indiaMap from '@svg-maps/india';
import { StateProjectData } from '../types';

interface IndiaMapSvgProps {
  selectedStateId: string;
  hoveredStateId: string | null;
  onSelectState: (stateId: string) => void;
  onHoverState: (stateId: string | null) => void;
  stateDataMap: Record<string, StateProjectData>;
}

export const IndiaMapSvg: React.FC<IndiaMapSvgProps> = ({
  selectedStateId,
  hoveredStateId,
  onSelectState,
  onHoverState,
  stateDataMap
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tooltip, setTooltip] = useState<{ name: string; count: number; x: number; y: number } | null>(null);

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.25, 2.4));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.75));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  /**
   * Project density color scale:
   * - High Density (>=15 Projects): Red (#dc2626)
   * - Medium Density (5-14 Projects): Orange (#ea580c)
   * - Emerging States (<5 Projects): Yellow (#eab308)
   */
  const getDensityTier = (count: number): 'high' | 'medium' | 'emerging' => {
    if (count >= 15) return 'high';
    if (count >= 5) return 'medium';
    return 'emerging';
  };

  const getDensityColor = (count: number): string => {
    if (count >= 15) return '#dc2626'; // High Density (>=15 Projects) - Vibrant Red
    if (count >= 5) return '#ea580c';  // Medium Density (5-14 Projects) - Vibrant Orange
    return '#eab308';                 // Emerging States (<5 Projects) - Warm Golden Yellow
  };

  /**
   * Determine state fill color:
   * - If selected: displays its vibrant density color (Red, Orange, or Yellow)
   * - If hovered: shows its own density color on preview
   * - If another state is selected: all other states are greyed out (#94a3b8)
   * - If no state is selected: all states show their density color
   */
  const getStateFillColor = (stateId: string, isSelected: boolean, isHovered: boolean) => {
    const data = stateDataMap[stateId.toLowerCase()];
    const count = data ? data.totalProjects : 0;
    const baseColor = getDensityColor(count);

    if (isSelected) {
      return baseColor; // Active selected state retains its density color
    }

    if (isHovered) {
      return baseColor; // Hovered state reveals its density color
    }

    if (selectedStateId) {
      return '#94a3b8'; // Greyout all other states when one is selected
    }

    return baseColor;
  };

  // Selected state metrics for reference box
  const selectedStateData = stateDataMap[selectedStateId.toLowerCase()];
  const selectedCount = selectedStateData ? selectedStateData.totalProjects : 0;
  const selectedTier = getDensityTier(selectedCount);
  const selectedColor = getDensityColor(selectedCount);

  return (
    <div 
      id="geographic-india-map-container"
      className="relative w-full h-[520px] sm:h-[580px] md:h-[640px] bg-transparent rounded-xl flex items-center justify-center overflow-hidden select-none border-none"
    >
      {/* Zoom / Pan Navigation Overlay (Top Left) */}
      <div className="absolute top-3.5 left-3.5 z-20 flex flex-col bg-white/95 rounded-lg shadow-sm border border-slate-200 overflow-hidden text-slate-700">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom In"
          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-sm font-bold border-b border-slate-200 transition-colors cursor-pointer"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom Out"
          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-sm font-bold border-b border-slate-200 transition-colors cursor-pointer"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          title="Reset Extent"
          className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 active:bg-slate-200 text-xs font-mono transition-colors cursor-pointer"
        >
          [ ]
        </button>
      </div>

      {/* Floating Hover Tooltip */}
      {tooltip && (
        <div
          className="absolute z-30 pointer-events-none bg-slate-900/95 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg border border-slate-700 backdrop-blur-xs transform -translate-x-1/2 -translate-y-full -mt-2 transition-all duration-75"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-bold text-slate-100">{tooltip.name}</div>
          <div className="text-[11px] font-semibold flex items-center gap-1 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getDensityColor(tooltip.count) }} />
            Projects: <span className="font-bold text-white">{tooltip.count}</span>
          </div>
        </div>
      )}

      {/* Main SVG Render Container - Enlarged & elevated to guarantee Kerala & Tamil Nadu are fully visible */}
      <svg
        viewBox="0 0 612 696"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full max-w-[580px] max-h-full transition-transform duration-200 ease-out cursor-pointer"
        style={{
          transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y - 20}px)`,
          transformOrigin: '50% 50%',
          filter: 'drop-shadow(0 4px 14px rgba(0, 75, 135, 0.12))'
        }}
        onMouseLeave={() => {
          setTooltip(null);
          onHoverState(null);
        }}
      >
        <defs>
          <filter id="geo-state-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#0f172a" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Geographic State Features Group */}
        <g id="geographic-india-states-layer">
          {indiaMap.locations.map((state: { id: string; name: string; path: string }) => {
            const stateId = state.id.toLowerCase();
            const isSelected = selectedStateId.toLowerCase() === stateId;
            const isHovered = hoveredStateId?.toLowerCase() === stateId;
            const data = stateDataMap[stateId];
            const projectCount = data ? data.totalProjects : 0;
            const fillColor = getStateFillColor(stateId, isSelected, isHovered);

            return (
              <g
                key={state.id}
                id={`geo-state-${stateId}`}
                className="transition-all duration-150"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectState(stateId);
                }}
                onMouseEnter={(e) => {
                  onHoverState(stateId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const parentRect = e.currentTarget.closest('svg')?.parentElement?.getBoundingClientRect();
                  if (parentRect) {
                    setTooltip({
                      name: data ? data.name : state.name,
                      count: projectCount,
                      x: rect.left + rect.width / 2 - parentRect.left,
                      y: rect.top - parentRect.top
                    });
                  }
                }}
                onMouseMove={(e) => {
                  const parentRect = e.currentTarget.closest('svg')?.parentElement?.getBoundingClientRect();
                  if (parentRect) {
                    setTooltip((prev) =>
                      prev
                        ? {
                            ...prev,
                            x: e.clientX - parentRect.left,
                            y: e.clientY - parentRect.top
                          }
                        : null
                    );
                  }
                }}
                onMouseLeave={() => {
                  onHoverState(null);
                  setTooltip(null);
                }}
              >
                {/* State Geographic Polygon: Crisp borders, greyed out if unselected, vibrant if selected/hovered */}
                <path
                  d={state.path}
                  fill={fillColor}
                  fillOpacity={isSelected || isHovered ? 1 : (selectedStateId ? 0.72 : 1)}
                  stroke="#ffffff"
                  strokeWidth={isSelected ? '3' : '1.1'}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className="transition-all duration-200 hover:brightness-110"
                  style={{
                    filter: isSelected ? 'url(#geo-state-shadow)' : undefined
                  }}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Bottom Left Project Density Reference Box (Positioned at bottom of box to guarantee Kerala and Tamil Nadu visibility) */}
      <div className="absolute bottom-1.5 left-2 sm:bottom-2 sm:left-2.5 z-10 bg-white/95 dark:bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-lg p-1.5 sm:p-2 shadow-sm text-[10px] sm:text-[10.5px] text-slate-800 space-y-1 font-medium pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span 
            className={`w-2.5 h-2.5 rounded-full bg-[#dc2626] flex-shrink-0 transition-all ${
              selectedTier === 'high' ? 'ring-2 ring-red-600 ring-offset-1 scale-110' : ''
            }`}
          />
          <span className={selectedTier === 'high' ? 'font-bold text-red-700' : 'text-slate-700'}>
            High Density (&ge;15 Projects)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span 
            className={`w-2.5 h-2.5 rounded-full bg-[#ea580c] flex-shrink-0 transition-all ${
              selectedTier === 'medium' ? 'ring-2 ring-orange-600 ring-offset-1 scale-110' : ''
            }`}
          />
          <span className={selectedTier === 'medium' ? 'font-bold text-orange-700' : 'text-slate-700'}>
            Medium Density (5-14 Projects)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span 
            className={`w-2.5 h-2.5 rounded-full bg-[#eab308] flex-shrink-0 transition-all ${
              selectedTier === 'emerging' ? 'ring-2 ring-yellow-600 ring-offset-1 scale-110' : ''
            }`}
          />
          <span className={selectedTier === 'emerging' ? 'font-bold text-yellow-700' : 'text-slate-700'}>
            Emerging States (&lt;5 Projects)
          </span>
        </div>

        {selectedStateData && (
          <div className="pt-1 mt-0.5 border-t border-slate-200 flex items-center justify-between gap-2 text-[9.5px] sm:text-[10px]">
            <span className="flex items-center gap-1 text-slate-950 font-bold truncate max-w-[125px]">
              <span 
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-slate-400"
                style={{ backgroundColor: selectedColor }}
              />
              {selectedStateData.name}:
            </span>
            <span className="font-bold whitespace-nowrap" style={{ color: selectedColor }}>
              {selectedCount} {selectedCount === 1 ? 'proj' : 'projs'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
