'use client';

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
          style={{ minHeight: 120, marginBottom: 10 }}
          value={editedContent ?? post.content}
          onChange={e => onContentChange(post.id, e.target.value)} />
        <input className="input-field"
          value={editedHashtags ?? post.hashtags}
          onChange={e => onHashtagsChange(post.id, e.target.value)} />
      </div>
      <div className="img-picker mobile-img-col">
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

function ImgOption({ label, bg, url, proxy, selected, onClick, disabled }: {
  label: string; bg: string; url: string | null; proxy?: boolean;
  selected: boolean; onClick: () => void; disabled: boolean;
}) {
  const src = url && proxy && !url.startsWith('data:')
    ? `/api/image-proxy?url=${encodeURIComponent(url)}` : url;
  return (
    <div className={`img-option ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}>
      <span className="img-label" style={{ background: bg }}>{label}</span>
      {url ? (
        <img src={src!} style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <span className="img-placeholder">
          {proxy ? 'Không có ảnh gốc' : 'AI không tạo được ảnh'}
        </span>
      )}
      {selected && <div className="img-check">✓</div>}
    </div>
  );
}
