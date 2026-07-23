/**
 * BottomToolbar — extensible tab bar for the story editor.
 *
 * Each entry is a ToolbarTabDef object. To add a future tool (music, filters,
 * draw) just push a new entry to TOOLBAR_TABS in index.tsx with
 * `available: false` until it's ready — this component renders "Soon" labels
 * automatically and keeps non-available tabs non-interactive.
 */

import React from 'react';
import type { ToolbarTabDef, ActivePanel } from './types';

interface BottomToolbarProps {
  tabs: ToolbarTabDef[];
  activePanel: ActivePanel;
  onTabPress: (id: string) => void;
}

export function BottomToolbar({ tabs, activePanel, onTabPress }: BottomToolbarProps) {
  return (
    <div className="flex items-center justify-around px-2 py-1">
      {tabs.map((tab) => {
        const active = activePanel === tab.id;
        return (
          <button
            key={tab.id}
            disabled={!tab.available}
            onClick={() => tab.available && onTabPress(tab.id)}
            className="flex flex-col items-center gap-[3px] px-3 py-2 rounded-xl transition-all active:scale-95"
            style={{
              background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
              opacity: tab.available ? 1 : 0.4,
            }}
          >
            <tab.Icon
              size={22}
              color={active ? '#ffffff' : 'rgba(255,255,255,0.72)'}
              strokeWidth={active ? 2.4 : 1.8}
            />
            <span
              className="text-[10px] font-semibold tracking-wide leading-none"
              style={{ color: active ? '#ffffff' : 'rgba(255,255,255,0.62)' }}
            >
              {tab.label}
            </span>
            {!tab.available && (
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', marginTop: -1 }}>
                Soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
