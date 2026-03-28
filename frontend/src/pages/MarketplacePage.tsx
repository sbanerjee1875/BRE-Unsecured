import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { dolls, Doll, FILTER_OPTIONS } from '../data/dolls';
import FilterSidebar, { Filters, defaultFilters } from '../components/marketplace/FilterSidebar';
import DollCard from '../components/marketplace/DollCard';
import DollDetailModal from '../components/marketplace/DollDetailModal';
import { trackClick } from '../hooks/useAnalytics';

const STATS = [
  { label: 'Dolls Listed', value: '75+', icon: '🎀' },
  { label: 'Countries', value: '30+', icon: '🌍' },
  { label: 'Brands', value: '50+', icon: '🏷️' },
  { label: 'Age Groups', value: '0-18', icon: '👧' },
];

export default function MarketplacePage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [selectedDoll, setSelectedDoll] = useState<Doll | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const filteredDolls = useMemo(() => {
    let result = [...dolls];

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.countryOfOrigin.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Type
    if (filters.types.length) {
      result = result.filter(d => filters.types.includes(d.type));
    }

    // Ethnicity
    if (filters.ethnicities.length) {
      result = result.filter(d => d.ethnicity.some(e => filters.ethnicities.includes(e)));
    }

    // Region
    if (filters.regions.length) {
      result = result.filter(d => filters.regions.includes(d.region));
    }

    // Country
    if (filters.countries.length) {
      result = result.filter(d => filters.countries.includes(d.countryOfOrigin));
    }

    // Age Group
    if (filters.ageGroups.length) {
      result = result.filter(d => d.ageGroup.some(a => filters.ageGroups.includes(a)));
    }

    // Price Range
    if (filters.priceRanges.length) {
      result = result.filter(d => filters.priceRanges.includes(d.priceRange));
    }

    // Features
    if (filters.features.length) {
      result = result.filter(d => d.features.some(f => filters.features.includes(f)));
    }

    // Materials
    if (filters.materials.length) {
      result = result.filter(d => filters.materials.includes(d.material));
    }

    // Sort
    switch (filters.sortBy) {
      case 'price-low':
        result.sort((a, b) => a.priceMin - b.priceMin);
        break;
      case 'price-high':
        result.sort((a, b) => b.priceMin - a.priceMin);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'reviews':
        result.sort((a, b) => b.reviews - a.reviews);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default: // popular
        result.sort((a, b) => b.reviews - a.reviews);
    }

    return result;
  }, [filters]);

  // Category quick filters
  const categories = [
    { label: 'All', icon: '🎀', filter: {} },
    { label: 'Baby Dolls', icon: '👶', filter: { types: ['Baby Doll'] } },
    { label: 'Fashion', icon: '👗', filter: { types: ['Fashion Doll'] } },
    { label: 'Cultural', icon: '🌍', filter: { types: ['Cultural/Traditional'] } },
    { label: 'Educational', icon: '📚', filter: { types: ['Educational'] } },
    { label: 'Collectible', icon: '💎', filter: { types: ['Collectible', 'BJD', 'Reborn Doll'] } },
    { label: 'Wooden', icon: '🪵', filter: { types: ['Wooden Doll', 'Nesting Doll'] } },
    { label: 'Eco', icon: '🌿', filter: { types: ['Waldorf Doll', 'Eco-Friendly'] } },
    { label: 'Puppets', icon: '🎭', filter: { types: ['Puppet'] } },
  ];

  const handleCategoryClick = (cat: typeof categories[0]) => {
    trackClick(`category:${cat.label}`, '/');
    if (cat.label === 'All') {
      setFilters(defaultFilters);
    } else {
      setFilters({ ...defaultFilters, ...cat.filter as Partial<Filters> });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-purple-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎀</span>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  DollWorld
                </h1>
                <p className="text-[10px] text-gray-400 -mt-0.5">Global Doll Marketplace</p>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search dolls, brands, countries..."
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-9 pr-4 py-2 bg-pink-50 border border-pink-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-pink-300 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link
                to="/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Admin
              </Link>
              <button className="relative p-2 text-gray-500 hover:text-pink-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button className="relative p-2 text-gray-500 hover:text-pink-600 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 bg-pink-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">0</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-10 text-8xl">🎀</div>
          <div className="absolute top-12 right-20 text-6xl">👶</div>
          <div className="absolute bottom-4 left-1/3 text-7xl">🌍</div>
          <div className="absolute bottom-8 right-10 text-5xl">👗</div>
          <div className="absolute top-2 left-1/2 text-6xl">🪆</div>
        </div>
        <div className="max-w-7xl mx-auto px-4 py-12 relative">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            Every Doll in the World,
            <br />
            <span className="text-pink-200">One Magical Place</span>
          </h2>
          <p className="text-pink-100 text-lg max-w-2xl mb-6">
            Discover dolls from 30+ countries for girls aged 0-18. From traditional Kokeshi to modern STEM dolls,
            find the perfect companion celebrating every culture, ethnicity, and age.
          </p>
          <div className="flex flex-wrap gap-6">
            {STATS.map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-pink-200 text-xs">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Quick Filters */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => (
            <button
              key={cat.label}
              onClick={() => handleCategoryClick(cat)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                (cat.label === 'All' && filters.types.length === 0)
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-200'
                  : cat.filter && 'types' in cat.filter && (cat.filter as any).types?.some((t: string) => filters.types.includes(t))
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-200'
                    : 'bg-white text-gray-600 border border-pink-100 hover:border-pink-300 hover:text-pink-600'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-12">
        <div className="flex gap-6">
          {/* Sidebar */}
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            totalResults={filteredDolls.length}
            isMobileOpen={mobileFiltersOpen}
            onMobileClose={() => setMobileFiltersOpen(false)}
          />

          {/* Product Grid */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden flex items-center gap-2 px-3 py-2 bg-white border border-pink-100 rounded-xl text-sm text-gray-600 hover:border-pink-300"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </button>
                <span className="text-sm text-gray-500">
                  Showing <strong className="text-gray-900">{filteredDolls.length}</strong> dolls
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filters.sortBy}
                  onChange={e => setFilters({ ...filters, sortBy: e.target.value })}
                  className="text-sm border border-pink-100 rounded-xl px-3 py-2 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="popular">Most Popular</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                  <option value="reviews">Most Reviewed</option>
                </select>

                <div className="hidden sm:flex items-center border border-pink-100 rounded-xl overflow-hidden">
                  <button
                    onClick={() => { setView('grid'); trackClick('view:grid', '/'); }}
                    className={`p-2 ${view === 'grid' ? 'bg-pink-500 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { setView('list'); trackClick('view:list', '/'); }}
                    className={`p-2 ${view === 'list' ? 'bg-pink-500 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Active filter pills */}
            {Object.entries(filters).some(([k, v]) => k !== 'search' && k !== 'sortBy' && Array.isArray(v) && v.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(filters).map(([key, vals]) => {
                  if (key === 'search' || key === 'sortBy' || !Array.isArray(vals)) return null;
                  return vals.map((v: string) => (
                    <button
                      key={`${key}-${v}`}
                      onClick={() => {
                        const next = (filters[key as keyof Filters] as string[]).filter(x => x !== v);
                        setFilters({ ...filters, [key]: next });
                      }}
                      className="flex items-center gap-1 bg-pink-100 text-pink-700 text-xs px-2.5 py-1 rounded-full hover:bg-pink-200 transition-colors"
                    >
                      {v}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ));
                })}
              </div>
            )}

            {/* Results */}
            {filteredDolls.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-6xl block mb-4">🔍</span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No dolls found</h3>
                <p className="text-gray-500 mb-4">Try adjusting your filters or search terms</p>
                <button
                  onClick={() => setFilters(defaultFilters)}
                  className="px-6 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className={
                view === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-3'
              }>
                {filteredDolls.map(doll => (
                  view === 'grid' ? (
                    <DollCard key={doll.id} doll={doll} onSelect={d => { trackClick(`doll:${d.name}`, '/'); setSelectedDoll(d); }} />
                  ) : (
                    <ListDollCard key={doll.id} doll={doll} onSelect={d => { trackClick(`doll:${d.name}`, '/'); setSelectedDoll(d); }} />
                  )
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🎀</span>
                <span className="text-lg font-bold">DollWorld</span>
              </div>
              <p className="text-gray-400 text-sm">The world's most comprehensive doll marketplace, celebrating every culture and age group.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Shop By Age</h4>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>0-1 Years (Infant)</li>
                <li>1-3 Years (Toddler)</li>
                <li>3-6 Years (Preschool)</li>
                <li>6-10 Years (School Age)</li>
                <li>10-14 Years (Tween)</li>
                <li>14-18 Years (Teen Collector)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Categories</h4>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>Fashion Dolls</li>
                <li>Baby Dolls</li>
                <li>Cultural & Traditional</li>
                <li>Educational & STEM</li>
                <li>Collectible & BJD</li>
                <li>Eco-Friendly & Waldorf</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Explore</h4>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>Dolls by Country</li>
                <li>Dolls by Ethnicity</li>
                <li>Inclusive & Diverse</li>
                <li>Handcrafted Artisan</li>
                <li>New Arrivals</li>
                <li>Gift Guide</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            DollWorld Marketplace &copy; 2026. Celebrating diversity through dolls from around the world.
          </div>
        </div>
      </footer>

      {/* Detail Modal */}
      <DollDetailModal doll={selectedDoll} onClose={() => setSelectedDoll(null)} />
    </div>
  );
}

// List view card
function ListDollCard({ doll, onSelect }: { doll: Doll; onSelect: (d: Doll) => void }) {
  const TYPE_ICONS: Record<string, string> = {
    'Baby Doll': '👶', 'Fashion Doll': '👗', 'Rag Doll': '🧸', 'Collectible': '💎',
    'Cultural/Traditional': '🌍', 'Educational': '📚', 'Interactive/Smart': '🤖',
    'Nesting Doll': '🪆', 'Puppet': '🎭', 'Wooden Doll': '🪵', 'Miniature Doll': '🔍',
    'Character Doll': '⭐', 'Reborn Doll': '🍼', 'BJD': '🎨', 'Waldorf Doll': '🌿',
  };
  const icon = TYPE_ICONS[doll.type] || '🎀';

  return (
    <div
      onClick={() => onSelect(doll)}
      className="bg-white rounded-xl border border-pink-100 p-4 flex gap-4 hover:shadow-md hover:border-pink-300 transition-all cursor-pointer"
    >
      <div className="w-20 h-20 bg-gradient-to-br from-pink-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <span className="text-3xl">{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{doll.name}</h3>
            <p className="text-xs text-gray-500">{doll.brand} &middot; {doll.countryOfOrigin}</p>
          </div>
          <span className="text-lg font-bold text-pink-600 whitespace-nowrap">
            ${doll.priceMin}{doll.priceMax > doll.priceMin ? `–$${doll.priceMax}` : ''}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{doll.description}</p>
        <div className="flex items-center gap-2 mt-2">
          {doll.ethnicity.slice(0, 2).map(e => (
            <span key={e} className="text-[10px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">{e}</span>
          ))}
          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{doll.ageGroup[0]}</span>
          <span className="text-xs text-yellow-500 ml-auto">{'★'.repeat(Math.round(doll.rating))} {doll.rating}</span>
        </div>
      </div>
    </div>
  );
}
