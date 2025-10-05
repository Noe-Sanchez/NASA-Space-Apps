import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { FilterState } from '../types/filters';

interface FilterControlsProps {
  onFilterChange: (filters: FilterState) => void;
}

export default function FilterControls({ onFilterChange }: FilterControlsProps) {
  const [showDropdown, setShowDropdown] = useState<'show' | 'sort' | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    showOnly: 'open',
    sortBy: 'nearest',
  });

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
    setShowDropdown(null);
  };

  const showOptions = [
    { value: 'all' as const, label: 'All Stores' },
    { value: 'open' as const, label: 'Open Now' },
    { value: 'closed' as const, label: 'Closed' },
  ];

  const sortOptions = [
    { value: 'nearest' as const, label: 'Nearest' },
    { value: 'rating' as const, label: 'Rating' },
    { value: 'name' as const, label: 'Name' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-400">Show me:</span>
        <span className="text-sm text-zinc-400">Sort by:</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Show Only Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(showDropdown === 'show' ? null : 'show')}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg transition-colors border border-zinc-800"
          >
            <span className="text-sm">
              {showOptions.find(opt => opt.value === filters.showOnly)?.label}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showDropdown === 'show' && (
            <div className="absolute top-full mt-1 left-0 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-10 min-w-full">
              {showOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFilter('showOnly', option.value)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    filters.showOnly === option.value ? 'text-white bg-zinc-800' : 'text-zinc-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort By Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(showDropdown === 'sort' ? null : 'sort')}
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg transition-colors border border-zinc-800"
          >
            <span className="text-sm">
              {sortOptions.find(opt => opt.value === filters.sortBy)?.label}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {showDropdown === 'sort' && (
            <div className="absolute top-full mt-1 left-0 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-10 min-w-full">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFilter('sortBy', option.value)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-800 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                    filters.sortBy === option.value ? 'text-white bg-zinc-800' : 'text-zinc-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters Button */}
        <button className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg transition-colors border border-zinc-800">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm">Filters</span>
        </button>
      </div>
    </div>
  );
}
