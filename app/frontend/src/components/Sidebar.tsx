import { useState } from 'react';
import SearchBar from './SearchBar.tsx';
import StoreList from './StoreList.tsx';
import FilterControls from './FilterControls.tsx';
import type { FilterState } from '../types/filters';

export default function Sidebar() {
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState<FilterState>({
    showOnly: 'open',
    sortBy: 'nearest',
  });

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  return (
    <aside className="w-96 bg-zinc-950 text-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-zinc-950" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
          </div>
          <span className="text-lg font-medium">outletbuddy</span>
        </div>

        <button className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4">
        <SearchBar searchValue={searchValue} setSearchValue={setSearchValue} />
      </div>

      {/* Filter Controls */}
      <div className="px-4 pb-4">
        <FilterControls onFilterChange={handleFilterChange} />
      </div>

      {/* Store List */}
      <div className="flex-1 overflow-y-auto">
        <StoreList searchValue={searchValue} filters={filters} />
      </div>
    </aside>
  );
}
