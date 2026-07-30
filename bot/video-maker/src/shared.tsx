import React from 'react';
import { interpolate } from 'remotion';

export function fadeSlideUp(frame: number, startAt: number, duration = 15) {
  const age = frame - startAt;
  const opacity = interpolate(age, [0, duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const y = interpolate(age, [0, duration], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { opacity, transform: `translateY(${y}px)` };
}

export interface CaptionLine {
  text: string;
  startFrame: number;
  sceneIndex?: number;
}

export interface VideoBlock {
  type: string;
  icon?: string;
  title?: string;
  subtitle?: string;
  value?: string;
  label?: string;
  left?: { label: string; value: string };
  right?: { label: string; value: string };
}

export interface VideoScene {
  text: string;
  startFrame: number;
  durationFrames: number;
  blocks: VideoBlock[];
}

export function useCaptionBlocks(lines: CaptionLine[], frame: number, linesPerBlock = 2) {
  const captionBlocks: { lines: CaptionLine[]; startFrame: number }[] = [];
  for (let i = 0; i < lines.length; i += linesPerBlock) {
    const blockLines = lines.slice(i, i + linesPerBlock);
    captionBlocks.push({ lines: blockLines, startFrame: blockLines[0]?.startFrame || 0 });
  }

  let currentBlockIndex = 0;
  for (let i = captionBlocks.length - 1; i >= 0; i--) {
    if (frame >= captionBlocks[i].startFrame) { currentBlockIndex = i; break; }
  }

  const current = captionBlocks[currentBlockIndex] || { lines: [], startFrame: 0 };
  const blockAge = frame - current.startFrame;
  const slideY = interpolate(blockAge, [0, 8], [20, 0], { extrapolateRight: 'clamp' });
  const opacity = interpolate(blockAge, [0, 6], [0, 1], { extrapolateRight: 'clamp' });

  return { current, slideY, opacity };
}

export const CaptionOverlay: React.FC<{
  lines: CaptionLine[];
  slideY: number;
  opacity: number;
}> = ({ lines, slideY, opacity }) => (
  <div style={{
    position: 'absolute', bottom: 120, left: 40, right: 40,
    textAlign: 'center', zIndex: 20,
    opacity, transform: `translateY(${slideY}px)`,
  }}>
    <div style={{ display: 'inline-block', padding: '20px 40px' }}>
      {lines.map((l, idx) => {
        const isHighlight = idx === 0;
        return (
          <div key={idx} style={{
            fontSize: isHighlight ? 54 : 44,
            fontWeight: isHighlight ? 900 : 700,
            color: isHighlight ? '#ffffff' : 'rgba(255,255,255,0.7)',
            marginBottom: 10, lineHeight: 1.3,
            textShadow: isHighlight
              ? '0 4px 12px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,1)'
              : '0 2px 8px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.8)',
          }}>
            {l.text}
          </div>
        );
      })}
    </div>
  </div>
);
