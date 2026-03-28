import React from 'react';
import { Doll } from '../../data/dolls';

interface DollDetailModalProps {
  doll: Doll | null;
  onClose: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  'Baby Doll': '👶', 'Fashion Doll': '👗', 'Rag Doll': '🧸', 'Porcelain Doll': '🏺',
  'Action Figure': '🦸‍♀️', 'Collectible': '💎', 'Cultural/Traditional': '🌍',
  'Educational': '📚', 'Interactive/Smart': '🤖', 'Paper Doll': '✂️',
  'Nesting Doll': '🪆', 'Puppet': '🎭', 'Wooden Doll': '🪵', 'Miniature Doll': '🔍',
  'Character Doll': '⭐', 'Reborn Doll': '🍼', 'BJD': '🎨', 'Waldorf Doll': '🌿',
};

export default function DollDetailModal({ doll, onClose }: DollDetailModalProps) {
  if (!doll) return null;

  const icon = TYPE_ICONS[doll.type] || '🎀';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-white/80 backdrop-blur-sm rounded-full p-2 hover:bg-white shadow-sm transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-br from-pink-100 via-purple-50 to-fuchsia-100 p-8 rounded-t-3xl flex items-center justify-center">
          <span className="text-8xl">{icon}</span>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{doll.name}</h2>
              <p className="text-gray-500">{doll.brand}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-pink-600">
                ${doll.priceMin}{doll.priceMax > doll.priceMin ? ` – $${doll.priceMax}` : ''}
              </p>
              <span className={`text-sm font-medium ${doll.inStock ? 'text-green-600' : 'text-red-500'}`}>
                {doll.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <svg
                  key={i}
                  className={`w-5 h-5 ${i <= Math.round(doll.rating) ? 'text-yellow-400' : 'text-gray-200'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm text-gray-600">{doll.rating.toFixed(1)} ({doll.reviews.toLocaleString()} reviews)</span>
          </div>

          {/* Description */}
          <p className="text-gray-700 mb-6 leading-relaxed">{doll.description}</p>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <DetailItem label="Type" value={doll.type} />
            <DetailItem label="Material" value={doll.material} />
            <DetailItem label="Country of Origin" value={doll.countryOfOrigin} />
            <DetailItem label="Region" value={doll.region} />
          </div>

          {/* Age groups */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Suitable Age Groups</h3>
            <div className="flex flex-wrap gap-2">
              {doll.ageGroup.map(a => (
                <span key={a} className="bg-purple-50 text-purple-700 text-sm px-3 py-1 rounded-full font-medium">
                  {a}
                </span>
              ))}
            </div>
          </div>

          {/* Ethnicity */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Ethnicity / Representation</h3>
            <div className="flex flex-wrap gap-2">
              {doll.ethnicity.map(e => (
                <span key={e} className="bg-pink-50 text-pink-700 text-sm px-3 py-1 rounded-full font-medium">
                  {e}
                </span>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Features</h3>
            <div className="flex flex-wrap gap-2">
              {doll.features.map(f => (
                <span key={f} className="bg-emerald-50 text-emerald-700 text-sm px-3 py-1 rounded-full font-medium">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {doll.tags.map(t => (
                <span key={t} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button className="flex-1 bg-pink-500 text-white font-semibold py-3 rounded-xl hover:bg-pink-600 transition-colors shadow-lg shadow-pink-200">
              Add to Cart
            </button>
            <button className="px-6 border-2 border-pink-200 text-pink-600 font-semibold py-3 rounded-xl hover:bg-pink-50 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
