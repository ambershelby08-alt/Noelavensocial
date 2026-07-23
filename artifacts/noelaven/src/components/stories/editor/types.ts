// ─── Shared editor types ──────────────────────────────────────────────────────
// All position values are percentages (0–100) of the canvas size so the editor
// is fully resolution-independent and the same spec renders in the viewer.

export type StoryMediaType = 'image' | 'video';

// ─── Layer types ──────────────────────────────────────────────────────────────

export interface TextLayer {
  id: string;
  kind: 'text';
  content: string;
  /** % of canvas width (anchor = layer centre) */
  x: number;
  /** % of canvas height (anchor = layer centre) */
  y: number;
  scale: number;       // multiplier on base fontSize
  rotation: number;    // degrees
  color: string;       // CSS colour string
  fontWeight: 'normal' | 'bold';
  /** Visual style applied behind/around the text */
  layerStyle: 'plain' | 'bubble-dark' | 'bubble-light' | 'outlined';
}

export interface StickerLayer {
  id: string;
  kind: 'sticker';
  content: string;     // emoji character(s)
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export type EditorLayer = TextLayer | StickerLayer;

// ─── Crop / trim ──────────────────────────────────────────────────────────────

/** All values are 0–100 percentage of original image dimensions. */
export interface CropData {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Values in seconds. */
export interface TrimData {
  start: number;
  end: number;
}

// ─── Full editor state ────────────────────────────────────────────────────────

/** String union — extend here to unlock future tool tabs. */
export type ActivePanel = 'text' | 'emoji' | null;

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
  | { type: 'UNDO' };

// ─── Toolbar tab descriptor ───────────────────────────────────────────────────
// Add new tools by pushing to TOOLBAR_TABS in index.tsx — the shell auto-renders.

export interface ToolbarTabDef {
  id: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: React.ComponentType<any>;
  /** false = tab shown as "coming soon" and non-interactive */
  available: boolean;
}
