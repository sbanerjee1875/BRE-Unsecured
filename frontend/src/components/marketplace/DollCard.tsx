import React from 'react';
import { Doll } from '../../data/dolls';

// Color palette for doll type backgrounds
const TYPE_COLORS: Record<string, string> = {
  'Baby Doll': 'from-pink-100 to-pink-200',
  'Fashion Doll': 'from-purple-100 to-fuchsia-200',
  'Rag Doll': 'from-amber-100 to-orange-200',
  'Porcelain Doll': 'from-blue-100 to-indigo-200',
  'Action Figure': 'from-red-100 to-red-200',
  'Collectible': 'from-violet-100 to-purple-200',
  'Cultural/Traditional': 'from-emerald-100 to-teal-200',
  'Educational': 'from-cyan-100 to-sky-200',
  'Interactive/Smart': 'from-blue-100 to-cyan-200',
  'Paper Doll': 'from-yellow-100 to-amber-200',
  'Nesting Doll': 'from-rose-100 to-pink-200',
  'Puppet': 'from-lime-100 to-green-200',
  'Wooden Doll': 'from-amber-100 to-yellow-200',
  'Miniature Doll': 'from-teal-100 to-emerald-200',
  'Character Doll': 'from-fuchsia-100 to-pink-200',
  'Reborn Doll': 'from-rose-100 to-rose-200',
  'BJD': 'from-indigo-100 to-violet-200',
  'Waldorf Doll': 'from-green-100 to-lime-200',
  'Eco-Friendly': 'from-green-100 to-emerald-200',
};

// Icon for each doll type
const TYPE_ICONS: Record<string, string> = {
  'Baby Doll': '👶',
  'Fashion Doll': '👗',
  'Rag Doll': '🧸',
  'Porcelain Doll': '🏺',
  'Action Figure': '🦸‍♀️',
  'Collectible': '💎',
  'Cultural/Traditional': '🌍',
  'Educational': '📚',
  'Interactive/Smart': '🤖',
  'Paper Doll': '✂️',
  'Nesting Doll': '🪆',
  'Puppet': '🎭',
  'Wooden Doll': '🪵',
  'Miniature Doll': '🔍',
  'Character Doll': '⭐',
  'Reborn Doll': '🍼',
  'BJD': '🎨',
  'Waldorf Doll': '🌿',
  'Eco-Friendly': '♻️',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

interface DollCardProps {
  doll: Doll;
  onSelect: (doll: Doll) => void;
}

export default function DollCard({ doll, onSelect }: DollCardProps) {
  const bgGradient = TYPE_COLORS[doll.type] || 'from-gray-100 to-gray-200';
  const icon = TYPE_ICONS[doll.type] || '🎀';

  return (
    <div
      onClick={() => onSelect(doll)}
      className="group bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden hover:shadow-lg hover:border-pink-300 transition-all duration-300 cursor-pointer hover:-translate-y-1"
    >
      {/* Image area */}
      <div className={`relative h-48 bg-gradient-to-br ${bgGradient} flex items-center justify-center overflow-hidden`}>
        <span className="text-6xl group-hover:scale-110 transition-transform duration-300">{icon}</span>

        {/* Tags */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {doll.tags.slice(0, 2).map(tag => (
            <span key={tag} className="bg-white/80 backdrop-blur-sm text-xs font-medium text-pink-700 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        {/* Country flag */}
        <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm text-xs font-medium text-gray-700 px-2 py-0.5 rounded-full">
          {doll.countryOfOrigin}
        </div>

        {/* Stock indicator */}
        {!doll.inStock && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="bg-white text-red-600 font-bold px-4 py-2 rounded-lg">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-gray-900 text-sm leading-tight group-hover:text-pink-600 transition-colors line-clamp-2">
            {doll.name}
          </h3>
        </div>

        <p className="text-xs text-gray-500 mb-2">{doll.brand}</p>

        <StarRating rating={doll.rating} />

        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doll.description}</p>

        {/* Ethnicity tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {doll.ethnicity.slice(0, 3).map(e => (
            <span key={e} className="text-[10px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded">
              {e}
            </span>
          ))}
          {doll.ethnicity.length > 3 && (
            <span className="text-[10px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">
              +{doll.ethnicity.length - 3}
            </span>
          )}
        </div>

        {/* Price and age */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-pink-50">
          <span className="text-lg font-bold text-pink-600">
            ${doll.priceMin}{doll.priceMax > doll.priceMin ? `–$${doll.priceMax}` : ''}
          </span>
          <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">
            {doll.ageGroup[0]}
          </span>
        </div>
      </div>
    </div>
  );
}
