import type { FilterPreset } from './filters';
export type { FilterPreset } from './filters';

// ─── Layer types ──────────────────────────────────────────────────────────────

export interface TextLayer {
  id: string;
  kind: 'text';
  content: string;
  x: number;        // % of canvas width (anchor = layer centre)
  y: number;        // % of canvas height (anchor = layer centre)
  scale: number;
  rotation: number; // degrees
  color: string;
  fontWeight: 'normal' | 'bold';
  layerStyle: 'plain' | 'bubble-dark' | 'bubble-light' | 'outlined';
}

export interface StickerLayer {
  id: string;
  kind: 'sticker';
  content: string;  // emoji character(s)
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export type EditorLayer = TextLayer | StickerLayer;

// ─── Crop / trim ──────────────────────────────────────────────────────────────

/** All values 0–100 % of original image dimensions. */
export interface CropData { x: number; y: number; w: number; h: number }

/** Values in seconds. */
export interface TrimData { start: number; end: number }

// ─── Media type ───────────────────────────────────────────────────────────────

export type StoryMediaType = 'image' | 'video';

// ─── Editor state ─────────────────────────────────────────────────────────────

export type ActivePanel = 'text' | 'emoji' | 'filters' | 'music' | null;

export interface EditorState {
  layers: EditorLayer[];
  selectedLayerId: string | null;
  activePanel: ActivePanel;
  cropMode: boolean;
  trimMode: boolean;
  crop: CropData | null;
  trim: TrimData | null;
  draftText: string;
  draftColor: string;
  draftFontWeight: 'normal' | 'bold';
  draftLayerStyle: TextLayer['layerStyle'];
  videoDuration: number;
  activeFilter: FilterPreset;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export type EditorAction =
  | { type: 'SET_PANEL'; panel: ActivePanel }
  | { type: 'SET_CROP_MODE'; active: boolean }
  | { type: 'SET_TRIM_MODE'; active: boolean }
  | { type: 'ADD_LAYER'; layer: EditorLayer }
  | { type: 'UPDATE_LAYER'; id: string; patch: Partial<EditorLayer> }
  | { type: 'DELETE_LAYER'; id: string }
  | { type: 'SELECT_LAYER'; id: string | null }
  | { type: 'SET_CROP'; crop: CropData | null }
  | { type: 'SET_TRIM'; trim: TrimData }
  | { type: 'SET_VIDEO_DURATION'; duration: number }
  | { type: 'SET_DRAFT_TEXT'; text: string }
  | { type: 'SET_DRAFT_COLOR'; color: string }
  | { type: 'SET_DRAFT_FONT_WEIGHT'; weight: 'normal' | 'bold' }
  | { type: 'SET_DRAFT_LAYER_STYLE'; style: TextLayer['layerStyle'] }
  | { type: 'SET_FILTER'; preset: FilterPreset }
  | { type: 'UNDO' };

// ─── Toolbar tab descriptor ───────────────────────────────────────────────────

export interface ToolbarTabDef {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
  available: boolean;
}
