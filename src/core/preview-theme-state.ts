import { PreviewTheme, PREVIEW_THEMES } from './constants';

let currentTheme: PreviewTheme = PREVIEW_THEMES[0];

export function setCurrentPreviewTheme(theme: PreviewTheme): void {
  currentTheme = theme;
}

export function getCurrentPreviewTheme(): PreviewTheme {
  return currentTheme;
}
