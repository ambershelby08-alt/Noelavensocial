/**
 * Story filter presets — CSS filter strings shared between the editor and viewer.
 * Add new presets here and they appear automatically in FilterPanel.
 */

export type FilterPreset =
  | 'normal' | 'warm' | 'cool' | 'vivid'
  | 'fade' | 'mono' | 'noir' | 'dreamy' | 'vintage';

export interface FilterDef {
  id: FilterPreset;
  label: string;
  css: string;
}

export const FILTER_DEFS: FilterDef[] = [
  { id: 'normal',  label: 'Normal',  css: 'none' },
  { id: 'warm',    label: 'Warm',    css: 'sepia(0.4) saturate(1.8) hue-rotate(-15deg)' },
  { id: 'cool',    label: 'Cool',    css: 'saturate(1.1) hue-rotate(12deg) brightness(1.08) contrast(0.97)' },
  { id: 'vivid',   label: 'Vivid',   css: 'saturate(2.1) contrast(1.12)' },
  { id: 'fade',    label: 'Fade',    css: 'brightness(1.2) contrast(0.82) saturate(0.65)' },
  { id: 'mono',    label: 'Mono',    css: 'grayscale(1)' },
  { id: 'noir',    label: 'Noir',    css: 'grayscale(1) contrast(1.8) brightness(0.72)' },
  { id: 'dreamy',  label: 'Dreamy',  css: 'brightness(1.12) contrast(0.88) saturate(1.4) hue-rotate(-5deg)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.55) saturate(1.1) contrast(1.08) brightness(0.95)' },
];

export function filterCSS(preset: FilterPreset): string {
  return FILTER_DEFS.find(f => f.id === preset)?.css ?? 'none';
}
