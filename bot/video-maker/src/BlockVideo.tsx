import React from 'react';
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import { fadeSlideUp, useCaptionBlocks, CaptionOverlay } from './shared';
import type { CaptionLine, VideoBlock } from './shared';

export const BlockVideo: React.FC<{
	audioUrl: string;
	lines?: CaptionLine[];
	totalFrames?: number;
	title?: string;
	blocks?: VideoBlock[];
}> = ({
	audioUrl,
	lines = [],
	title = '#1 Warp',
	blocks = [
		{ type: 'info', icon: '🤖', title: 'Terminal thế hệ mới', subtitle: 'Tích hợp AI Agent' },
		{ type: 'stat', icon: '⭐', value: '48.243', label: 'Sao tổng cộng' },
		{ type: 'stat', icon: '🦀', value: 'Rust', label: 'Ngôn ngữ lập trình' },
	]
}) => {
	const frame = useCurrentFrame();
	const caption = useCaptionBlocks(lines, frame);

	// Blocks timing (staggered entrance)
	const blockStartDelay = 30; // Wait 1s before showing blocks
	const staggerDelay = 20;

	return (
		<AbsoluteFill style={{ backgroundColor: '#09090b', fontFamily: "system-ui, -apple-system, sans-serif" }}>
			{/* Audio */}
			{audioUrl && audioUrl.length > 0 && <Audio src={staticFile(audioUrl)} volume={1} />}

			{/* Background Gradient */}
			<div style={{
				position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
				background: 'linear-gradient(180deg, rgba(139,92,246,0.15) 0%, transparent 100%)',
			}} />

			{/* ===== HEADER ===== */}
			<div style={{
				position: 'absolute', top: 120, left: 0, right: 0,
				textAlign: 'center', zIndex: 10,
				...fadeSlideUp(frame, 10, 20)
			}}>
				<div style={{ fontSize: 60, display: 'inline-block', background: 'rgba(139,92,246,0.2)', padding: '10px 20px', borderRadius: 20, marginBottom: 20 }}>
					⚡
				</div>
				<h1 style={{ fontSize: 72, fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 4px 20px rgba(139,92,246,0.5)' }}>
					<span style={{ color: '#a78bfa' }}>{title.split(' ')[0]}</span> {title.split(' ').slice(1).join(' ')}
				</h1>
				<div style={{ fontSize: 24, color: '#a1a1aa', marginTop: 10 }}>warpdotdev / warp</div>
			</div>

			{/* ===== CENTER BLOCKS ===== */}
			<div style={{
				position: 'absolute', top: 380, left: 60, right: 60,
				display: 'flex', flexDirection: 'column', gap: 24, zIndex: 5
			}}>
				{blocks.map((block, index) => {
					const startAt = blockStartDelay + (index * staggerDelay);
					
					return (
						<div key={index} style={{
							background: 'linear-gradient(90deg, rgba(24,24,27,0.8) 0%, rgba(39,39,42,0.8) 100%)',
							border: '1px solid rgba(139,92,246,0.3)',
							borderRadius: 24, padding: '30px 40px',
							display: 'flex', alignItems: 'center', gap: 30,
							boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
							...fadeSlideUp(frame, startAt, 20)
						}}>
							<div style={{ 
								fontSize: 50, width: 90, height: 90, 
								background: 'rgba(255,255,255,0.05)', borderRadius: 20, 
								display: 'flex', alignItems: 'center', justifyContent: 'center' 
							}}>
								{block.icon}
							</div>
							
							{block.type === 'info' && (
								<div style={{ flex: 1 }}>
									<div style={{ fontSize: 36, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{block.title}</div>
									<div style={{ fontSize: 24, color: '#a1a1aa' }}>{block.subtitle}</div>
								</div>
							)}
							
							{block.type === 'stat' && (
								<div style={{ flex: 1 }}>
									<div style={{ fontSize: 42, fontWeight: 800, color: '#fbbf24', marginBottom: 8 }}>
										{block.value}
									</div>
									<div style={{ fontSize: 24, color: '#a1a1aa' }}>{block.label}</div>
								</div>
							)}
						</div>
					);
				})}
			</div>

			<CaptionOverlay lines={caption.current.lines} slideY={caption.slideY} opacity={caption.opacity} />
		</AbsoluteFill>
	);
};
