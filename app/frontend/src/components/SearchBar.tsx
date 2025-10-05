import { Search } from 'lucide-react';

interface SearchBarProps {
  searchValue: string;
  setSearchValue: (value: string) => void;
}

export default function SearchBar({ searchValue, setSearchValue }: SearchBarProps) {
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Searching for:', searchValue);
  };

  return (
    <form onSubmit={handleSearch} className="relative">
      <input
        type="text"
        placeholder="Search..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="w-full bg-zinc-900 text-white placeholder-zinc-500 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-zinc-700"
      />
      <button
        type="submit"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
      >
        <Search className="w-5 h-5" />
      </button>
    </form>
  );
}
