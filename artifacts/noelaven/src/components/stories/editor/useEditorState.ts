import { useReducer, useCallback } from 'react';
import type { EditorState, EditorAction, EditorLayer, TextLayer, StickerLayer } from './types';

// ─── Initial state ────────────────────────────────────────────────────────────

export const INITIAL_EDITOR_STATE: EditorState = {
  layers: [],
  selectedLayerId: null,
  activePanel: null,
  cropMode: false,
  trimMode: false,
  crop: null,
  trim: null,
  draftText: '',
  draftColor: '#FFFFFF',
  draftFontWeight: 'bold',
  draftLayerStyle: 'plain',
  videoDuration: 0,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_PANEL':
      return { ...state, activePanel: action.panel, cropMode: false, trimMode: false };

    case 'SET_CROP_MODE':
      return { ...state, cropMode: action.active, trimMode: false, activePanel: null, selectedLayerId: null };

    case 'SET_TRIM_MODE':
      return { ...state, trimMode: action.active, cropMode: false, activePanel: null, selectedLayerId: null };

    case 'ADD_LAYER':
      return {
        ...state,
        layers: [...state.layers, action.layer],
        selectedLayerId: action.layer.id,
        activePanel: null,
        draftText: '',
      };

    case 'UPDATE_LAYER': {
      const layers = state.layers.map((l) =>
        l.id === action.id ? { ...l, ...action.patch } as EditorLayer : l,
      );
      return { ...state, layers };
    }

    case 'DELETE_LAYER':
      return {
        ...state,
        layers: state.layers.filter((l) => l.id !== action.id),
        selectedLayerId: state.selectedLayerId === action.id ? null : state.selectedLayerId,
      };

    case 'SELECT_LAYER':
      return { ...state, selectedLayerId: action.id };

    case 'SET_CROP':
      return { ...state, crop: action.crop, cropMode: false };

    case 'SET_TRIM':
      return { ...state, trim: action.trim };

    case 'SET_VIDEO_DURATION':
      return {
        ...state,
        videoDuration: action.duration,
        trim: state.trim ?? { start: 0, end: action.duration },
      };

    case 'SET_DRAFT_TEXT':         return { ...state, draftText: action.text };
    case 'SET_DRAFT_COLOR':        return { ...state, draftColor: action.color };
    case 'SET_DRAFT_FONT_WEIGHT':  return { ...state, draftFontWeight: action.weight };
    case 'SET_DRAFT_LAYER_STYLE':  return { ...state, draftLayerStyle: action.style };

    case 'UNDO': {
      if (state.layers.length === 0) return state;
      return { ...state, layers: state.layers.slice(0, -1), selectedLayerId: null };
    }

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEditorState() {
  const [state, dispatch] = useReducer(editorReducer, INITIAL_EDITOR_STATE);

  const addTextLayer = useCallback(
    (text: string, x = 50, y = 50, opts: Partial<TextLayer> = {}) => {
      const layer: TextLayer = {
        id: `text-${Date.now()}`,
        kind: 'text',
        content: text,
        x, y,
        scale: 1,
        rotation: 0,
        color: opts.color ?? '#FFFFFF',
        fontWeight: opts.fontWeight ?? 'bold',
        layerStyle: opts.layerStyle ?? 'plain',
      };
      dispatch({ type: 'ADD_LAYER', layer });
    },
    [],
  );

  const addStickerLayer = useCallback(
    (emoji: string, x = 50, y = 50) => {
      // Slightly randomise position so multiple stickers don't stack exactly
      const jitter = () => (Math.random() - 0.5) * 10;
      const layer: StickerLayer = {
        id: `sticker-${Date.now()}`,
        kind: 'sticker',
        content: emoji,
        x: Math.min(90, Math.max(10, x + jitter())),
        y: Math.min(85, Math.max(15, y + jitter())),
        scale: 1,
        rotation: 0,
      };
      dispatch({ type: 'ADD_LAYER', layer });
    },
    [],
  );

  const updateLayer = useCallback((id: string, patch: Partial<EditorLayer>) => {
    dispatch({ type: 'UPDATE_LAYER', id, patch });
  }, []);

  const deleteLayer = useCallback((id: string) => {
    dispatch({ type: 'DELETE_LAYER', id });
  }, []);

  const selectLayer = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_LAYER', id });
  }, []);

  return { state, dispatch, addTextLayer, addStickerLayer, updateLayer, deleteLayer, selectLayer };
}
