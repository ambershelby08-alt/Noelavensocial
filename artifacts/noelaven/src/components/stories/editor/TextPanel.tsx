/**
 * TextPanel — compose and style a text layer before placing it on the canvas.
 */

import React from 'react';
import { Bold } from 'lucide-react';
import type { EditorState, EditorAction, TextLayer } from './types';

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FFD700', '#FF6B9D',
  '#6B73FF', '#00E5FF', '#69FF47', '#FF4747',
  '#FF9500', '#C44FDB',
];

const LAYER_STYLES: { value: TextLayer['layerStyle']; label: string }[] = [
  { value: 'plain',        label: 'Plain'   },
  { value: 'outlined',     label: 'Outline' },
  { value: 'bubble-dark',  label: 'Dark'    },
  { value: 'bubble-light', label: 'Light'   },
];

interface TextPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onAdd: () => void;
}

export function TextPanel({ state, dispatch, onAdd }: TextPanelProps) {
  const { draftText, draftColor, draftFontWeight, draftLayerStyle } = state;

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Text input */}
      <textarea
        autoFocus
        value={draftText}
        onChange={(e) => dispatch({ type: 'SET_DRAFT_TEXT', text: e.target.value })}
        placeholder="Type something…"
        rows={2}
        maxLength={120}
        className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30"
      />

      {/* Colour swatches */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => dispatch({ type: 'SET_DRAFT_COLOR', color: c })}
            style={{
              background: c,
              border: draftColor === c ? '3px solid white' : '2px solid rgba(255,255,255,0.25)',
              transform: draftColor === c ? 'scale(1.15)' : 'scale(1)',
            }}
            className="w-7 h-7 rounded-full flex-shrink-0 transition-transform active:scale-90 shadow"
          />
        ))}
      </div>

      {/* Style options */}
      <div className="flex gap-2 items-center overflow-x-auto scrollbar-none">
        {/* Bold toggle */}
        <button
          onClick={() =>
            dispatch({
              type: 'SET_DRAFT_FONT_WEIGHT',
              weight: draftFontWeight === 'bold' ? 'normal' : 'bold',
            })
          }
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors"
          style={{
            background: draftFontWeight === 'bold' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
            color: 'white',
          }}
        >
          <Bold size={12} /> Bold
        </button>

        {/* Background style */}
        {LAYER_STYLES.map((s) => (
          <button
            key={s.value}
            onClick={() => dispatch({ type: 'SET_DRAFT_LAYER_STYLE', style: s.value })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-colors"
            style={{
              background: draftLayerStyle === s.value ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
              color: 'white',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={onAdd}
        disabled={!draftText.trim()}
        className="w-full py-2.5 rounded-xl font-bold text-white text-sm active:scale-[0.98] transition-transform disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg, #FF6B9D, #C44FDB, #6B73FF)' }}
      >
        Add to Story ✨
      </button>
    </div>
  );
}
