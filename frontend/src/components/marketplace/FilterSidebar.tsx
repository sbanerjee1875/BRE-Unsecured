import React, { useState } from 'react';
import { FILTER_OPTIONS } from '../../data/dolls';

export interface Filters {
  search: string;
  types: string[];
  ethnicities: string[];
  regions: string[];
  countries: string[];
  ageGroups: string[];
  priceRanges: string[];
  features: string[];
  materials: string[];
  sortBy: string;
}

export const defaultFilters: Filters = {
  search: '',
  types: [],
  ethnicities: [],
  regions: [],
  countries: [],
  ageGroups: [],
  priceRanges: [],
  features: [],
  materials: [],
  sortBy: 'popular',
};

interface FilterSidebarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  totalResults: number;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

function FilterSection({ title, options, selected, onToggle, defaultOpen = false }: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (val: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-pink-100 pb-3 mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left font-semibold text-gray-800 text-sm hover:text-pink-600 transition-colors"
      >
        <span>{title}</span>
        <span className="flex items-center gap-1">
          {selected.length > 0 && (
            <span className="bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {selected.length}
            </span>
          )}
          <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1 pr-1">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 hover:text-pink-600 py-0.5">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="rounded border-gray-300 text-pink-500 focus:ring-pink-400 w-4 h-4"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterSidebar({ filters, onChange, totalResults, isMobileOpen, onMobileClose }: FilterSidebarProps) {
  const toggle = (key: keyof Filters, val: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    onChange({ ...filters, [key]: next });
  };

  const clearAll = () => onChange(defaultFilters);
  const activeCount = Object.entries(filters).reduce((acc, [key, val]) => {
    if (key === 'search' || key === 'sortBy') return acc;
    return acc + (Array.isArray(val) ? val.length : 0);
  }, 0);

  const content = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </h2>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs text-pink-600 hover:text-pink-700 font-medium">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">{totalResults} dolls found</p>

      <div className="flex-1 overflow-y-auto space-y-0">
        <FilterSection title="Doll Type" options={FILTER_OPTIONS.types} selected={filters.types} onToggle={v => toggle('types', v)} defaultOpen />
        <FilterSection title="Age Group" options={FILTER_OPTIONS.ageGroups} selected={filters.ageGroups} onToggle={v => toggle('ageGroups', v)} defaultOpen />
        <FilterSection title="Price Range" options={FILTER_OPTIONS.priceRanges} selected={filters.priceRanges} onToggle={v => toggle('priceRanges', v)} defaultOpen />
        <FilterSection title="Ethnicity / Representation" options={FILTER_OPTIONS.ethnicities} selected={filters.ethnicities} onToggle={v => toggle('ethnicities', v)} />
        <FilterSection title="Region" options={FILTER_OPTIONS.regions} selected={filters.regions} onToggle={v => toggle('regions', v)} />
        <FilterSection title="Country of Origin" options={FILTER_OPTIONS.countries} selected={filters.countries} onToggle={v => toggle('countries', v)} />
        <FilterSection title="Features" options={FILTER_OPTIONS.features} selected={filters.features} onToggle={v => toggle('features', v)} />
        <FilterSection title="Material" options={FILTER_OPTIONS.materials} selected={filters.materials} onToggle={v => toggle('materials', v)} />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-pink-100 p-5 h-fit sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden">
        {content}
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onMobileClose} />
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-white p-5 shadow-xl overflow-y-auto">
            <button onClick={onMobileClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
