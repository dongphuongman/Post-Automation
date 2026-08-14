'use client';

import { useState } from 'react';
import type { Post, ImageType } from '@/types';

interface PostCardProps {
  post: Post;
  selected: boolean;
  imageChoice?: ImageType;
  editedContent?: string;
  editedHashtags?: string;
  onToggle: (id: string) => void;
  onImageChoice: (id: string, type: ImageType) => void;
  onContentChange: (id: string, content: string) => void;
  onHashtagsChange: (id: string, hashtags: string) => void;
  onRegenerateImage: (id: string) => void;
  regenerating: boolean;
}

export function PostCard({
  post, selected, imageChoice, editedContent, editedHashtags,
  onToggle, onImageChoice, onContentChange, onHashtagsChange,
  onRegenerateImage, regenerating,
}: PostCardProps) {
  return (
    <div className={`card mobile-col ${selected ? 'card-selected' : ''}`}
      style={{ padding: 24, display: 'flex', gap: 20 }}>
      <div className="checkbox-wrapper">
        <input type="checkbox" className="checkbox" checked={selected}
          onChange={() => onToggle(post.id)} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className={`badge ${post.format === 'pov' ? 'badge-pov' : 'badge-info'}`}>
            {post.format.toUpperCase()}
          </span>
          <a href={post.article_url} target="_blank" rel="noreferrer" className="meta-link">
            Bài gốc →
          </a>
        </div>
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {post.article_title}
        </div>
        <textarea className="input-field"
          style={{ minHeight: 120, marginBottom: 6 }}
          value={editedContent ?? post.content}
          onChange={e => onContentChange(post.id, e.target.value)} />
        <CharCounter text={editedContent ?? post.content ?? ''} />
        <input className="input-field" style={{ marginTop: 10 }}
          value={editedHashtags ?? post.hashtags}
          onChange={e => onHashtagsChange(post.id, e.target.value)} />
      </div>
      <div className="img-picker">
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Chọn ảnh
        </p>
        <ImgOption label="Ảnh gốc" bg="rgba(0,0,0,0.55)" url={post.original_image_url}
          proxy selected={imageChoice === 'original'}
          onClick={() => post.original_image_url && onImageChoice(post.id, 'original')}
          disabled={!post.original_image_url} />
        <ImgOption label="AI tạo" bg="rgba(99,102,241,0.85)" url={post.generated_image_url}
          selected={imageChoice === 'generated'}
          onClick={() => post.generated_image_url && onImageChoice(post.id, 'generated')}
          disabled={!post.generated_image_url} />
        <button type="button" className="btn-secondary" style={{ fontSize: 12, padding: '6px 10px', width: '100%' }}
          disabled={regenerating} onClick={() => onRegenerateImage(post.id)}>
          {regenerating ? '⏳ Đang tạo…' : (post.generated_image_url ? '🔄 Tạo lại ảnh' : '✨ Tạo ảnh AI')}
        </button>
      </div>
    </div>
  );
}

// Đếm ký tự + cảnh báo nền tảng nào sẽ cắt bớt (X 280, Threads 500, Instagram 2200).
// Đích đăng chọn lúc bấm nút nên chỉ báo trước các giới hạn bị vượt.
const PLATFORM_LIMITS: [string, number][] = [['X', 280], ['Threads', 500], ['Instagram', 2200]];
function CharCounter({ text }: { text: string }) {
  const len = text.length;
  const exceeded = PLATFORM_LIMITS.filter(([, lim]) => len > lim).map(([name, lim]) => `${name} (${lim})`);
  return (
    <div style={{ fontSize: 12, color: exceeded.length ? 'var(--danger)' : 'var(--text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <span>{len} ký tự</span>
      {exceeded.length > 0 && <span>⚠️ vượt giới hạn: {exceeded.join(', ')} — sẽ bị cắt</span>}
    </div>
  );
}

function ImgOption({ label, bg, url, proxy, selected, onClick, disabled }: {
  label: string; bg: string; url: string | null; proxy?: boolean;
  selected: boolean; onClick: () => void; disabled: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const src = url && proxy && !url.startsWith('data:')
    ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
  return (
    <div className={`img-option ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}>
      <span className="img-label" style={{ background: bg }}>{label}</span>
      {url && !broken ? (
        <img src={src!} alt={label} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
          onError={() => setBroken(true)} />
      ) : (
        <span className="img-placeholder">
          {!url ? (proxy ? 'Không có ảnh gốc' : 'AI không tạo được ảnh') : 'Ảnh lỗi / không tải được'}
        </span>
      )}
      {selected && <div className="img-check">✓</div>}
    </div>
  );
}
