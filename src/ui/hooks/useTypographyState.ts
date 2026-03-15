import { useState } from "preact/hooks";
import { TypographySettings } from "../state";

// Default values are extracted from the current ui.tsx state
const initialSettings: TypographySettings = {
  desktop: {
    baseSize: 16,
    scaleRatio: 1.333,
    systemPreset: undefined,
    letterSpacing: 2.75,
    maxLetterSpacing: -2.25,
    headingLetterSpacing: 2.75,
    headingMaxLetterSpacing: -2.25,
    textLetterSpacing: 2.75,
    textMaxLetterSpacing: -2.25,
    headlineMinLineHeight: 100,
    headlineMaxLineHeight: 125,
    textMinLineHeight: 135,
    textMaxLineHeight: 150, // CHANGED: Text Tiny line height from 175% to 150%
    maxSize: 80,
    minSize: 12,
    interpolationType: "exponential",
  },
  mobile: {
    baseSize: 14,
    scaleRatio: 1.4,
    systemPreset: undefined,
    letterSpacing: 2,
    maxLetterSpacing: -2,
    headingLetterSpacing: 2,
    headingMaxLetterSpacing: -2,
    textLetterSpacing: 2,
    textMaxLetterSpacing: -2,
    headlineMinLineHeight: 115,
    headlineMaxLineHeight: 135,
    textMinLineHeight: 145,
    textMaxLineHeight: 150, // CHANGED: Text Tiny line height from 175% to 150%
    maxSize: 60,
    minSize: 10,
    interpolationType: "exponential",
  },
};

export function useTypographyState() {
  const [settings, setSettings] = useState<TypographySettings>(initialSettings);

  return {
    settings,
    setSettings,
  };
} 