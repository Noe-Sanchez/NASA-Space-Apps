import { useState, useMemo } from 'react';
import { MapPin, Plus } from 'lucide-react';
import type { FilterState } from '../types/filters';

interface Store {
  name: string;
  distance: string;
  status: string;
  logo: string;
  bgColor: string;
  isOpen: boolean;
  distanceValue: number;
}

interface StoreListProps {
  searchValue: string;
  filters: FilterState;
}

const stores: Store[] = [
  {
    name: 'Adidas',
    distance: '0.5 mi',
    distanceValue: 0.5,
    status: "Open 'til 8pm",
    logo: '🏃',
    bgColor: 'bg-white',
    isOpen: true
  },
  {
    name: 'Nike',
    distance: '0.7 mi',
    distanceValue: 0.7,
    status: "Open 'til 8pm",
    logo: '✓',
    bgColor: 'bg-pink-200',
    isOpen: true
  },
  {
    name: 'Puma',
    distance: '0.3 mi',
    distanceValue: 0.3,
    status: "Open 'til 8pm",
    logo: '🐆',
    bgColor: 'bg-white',
    isOpen: true
  },
  {
    name: 'Under Armour',
    distance: '0.2 mi',
    distanceValue: 0.2,
    status: "Open 'til 8pm",
    logo: 'UA',
    bgColor: 'bg-white',
    isOpen: true
  },
  {
    name: 'Timberland',
    distance: '0.4 mi',
    distanceValue: 0.4,
    status: "Closed",
    logo: '🌲',
    bgColor: 'bg-amber-200',
    isOpen: false
  },
  {
    name: 'EA7 Emporio Armani',
    distance: '2.1 mi',
    distanceValue: 2.1,
    status: "Open 'til 8pm",
    logo: 'EA7',
    bgColor: 'bg-zinc-400',
    isOpen: true
  },
  {
    name: 'Converse',
    distance: '2.5 mi',
    distanceValue: 2.5,
    status: "Closed",
    logo: '⭐',
    bgColor: 'bg-zinc-400',
    isOpen: false
  }
];

export default function StoreList({ searchValue, filters }: StoreListProps) {
  const [selectedStore, setSelectedStore] = useState<string | null>(null);

  const filteredStores = useMemo(() => {
    let filtered = [...stores];

    // Filter by search
    if (searchValue.trim()) {
      const search = searchValue.toLowerCase();
      filtered = filtered.filter(store =>
        store.name.toLowerCase().includes(search)
      );
    }

    // Filter by open/closed status
    if (filters.showOnly === 'open') {
      filtered = filtered.filter(store => store.isOpen);
    } else if (filters.showOnly === 'closed') {
      filtered = filtered.filter(store => !store.isOpen);
    }

    // Sort
    filtered.sort((a, b) => {
      if (filters.sortBy === 'nearest') {
        return a.distanceValue - b.distanceValue;
      } else if (filters.sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // Add rating logic when available
      return 0;
    });

    return filtered;
  }, [searchValue, filters]);

  const handleStoreClick = (storeName: string) => {
    setSelectedStore(storeName);
    console.log('Selected store:', storeName);
    // Add logic to update map, show details, etc.
  };

  const handleLocationClick = (storeName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Show location for:', storeName);
    // Add logic to center map on store location
  };

  const handleAddClick = (storeName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Add to favorites:', storeName);
    // Add logic to save to favorites/list
  };

  return (
    <div className="space-y-1 px-4 pb-4">
      {filteredStores.length === 0 ? (
        <div className="text-center text-zinc-400 py-8">
          No stores found matching "{searchValue}"
        </div>
      ) : (
        filteredStores.map((store) => (
        <div
          key={store.name}
          onClick={() => handleStoreClick(store.name)}
          className={`flex items-center gap-3 p-3 hover:bg-zinc-900 rounded-lg transition-colors group cursor-pointer ${
            selectedStore === store.name ? 'bg-zinc-900 ring-2 ring-zinc-700' : ''
          }`}
        >
          {/* Logo */}
          <div className={`w-12 h-12 ${store.bgColor} rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold`}>
            {store.logo}
          </div>

          {/* Store Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm">{store.name}</h3>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{store.distance}</span>
              <span>•</span>
              <span className={store.isOpen ? "text-green-400" : "text-red-400"}>{store.status}</span>
            </div>
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => handleLocationClick(store.name, e)}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <MapPin className="w-5 h-5 text-zinc-400" />
            </button>
            <button
              onClick={(e) => handleAddClick(store.name, e)}
              className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>
        ))
      )}
    </div>
  );
}
