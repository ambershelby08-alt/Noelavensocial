/**
 * FilterPanel — horizontal carousel of CSS filter presets.
 * Each tile shows the live story media with the filter applied via a
 * CSS `filter` property on a tiny preview image, so the user can compare
 * before committing.
 */

import React from 'react';
import { Check } from 'lucide-react';
import { FILTER_DEFS, type FilterPreset } from './filters';

interface FilterPanelProps {
  /** URL of the current story media (image or video poster) */
  previewUrl: string;
  mediaType: 'image' | 'video';
  activeFilter: FilterPreset;
  onSelect: (filter: FilterPreset) => void;
}

export function FilterPanel({ previewUrl, mediaType, activeFilter, onSelect }: FilterPanelProps) {
  return (
    <div className="px-3 py-3">
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
        {FILTER_DEFS.map(({ id, label, css }) => {
          const isActive = activeFilter === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              {/* Thumbnail */}
              <div
                className="relative rounded-xl overflow-hidden"
                style={{
                  width: 68, height: 68,
                  border: isActive ? '3px solid white' : '2px solid rgba(255,255,255,0.2)',
                  boxShadow: isActive ? '0 0 0 1px rgba(255,255,255,0.5)' : 'none',
                }}
              >
                {mediaType === 'image' ? (
                  <img
                    src={previewUrl}
                    alt={label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: css }}
                    draggable={false}
                  />
                ) : (
                  <video
                    src={previewUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', filter: css }}
                    muted
                    playsInline
                  />
                )}

                {/* Active check */}
                {isActive && (
                  <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow">
                    <Check size={10} strokeWidth={3} className="text-gray-900" />
                  </div>
                )}
              </div>

              {/* Label */}
              <span
                className="text-[10px] font-semibold leading-none"
                style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.6)' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
