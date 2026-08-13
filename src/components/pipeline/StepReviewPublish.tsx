'use client';

import type { Post, PostTarget, ImageType } from '@/types';
import { PostCard } from './PostCard';
import { ScheduleSettings } from './ScheduleSettings';
import { PublishActions } from './PublishActions';
import { PostHistory } from './PostHistory';
import { TargetSelector } from './TargetSelector';

interface StepReviewPublishProps {
  draftPosts: Post[];
  publishedPosts: Post[];
  selectedPosts: Set<string>;
  selectedImages: Record<string, ImageType>;
  editedContent: Record<string, string>;
  editedHashtags: Record<string, string>;
  loading: boolean;
  scheduleStart: string;
  scheduleInterval: number;
  onScheduleStartChange: (value: string) => void;
  onScheduleIntervalChange: (value: number) => void;
  onTogglePost: (id: string) => void;
  onImageChoice: (id: string, type: ImageType) => void;
  onContentChange: (id: string, content: string) => void;
  onHashtagsChange: (id: string, hashtags: string) => void;
  onRegenerateImage: (id: string) => void;
  regeneratingIds: Set<string>;
  onPublish: (target: PostTarget) => void;
  onDelete: () => void;
  targetPageIds: string[];
  targetGroupIds: string[];
  onTargetPagesChange: (ids: string[]) => void;
  onTargetGroupsChange: (ids: string[]) => void;
}

export function StepReviewPublish(props: StepReviewPublishProps) {
  return (
    <div className="animate-in">
      <TargetSelector pageIds={props.targetPageIds} groupIds={props.targetGroupIds}
        onPagesChange={props.onTargetPagesChange} onGroupsChange={props.onTargetGroupsChange} />

      <ScheduleSettings scheduleStart={props.scheduleStart} scheduleInterval={props.scheduleInterval}
        onStartChange={props.onScheduleStartChange} onIntervalChange={props.onScheduleIntervalChange} />

      <div className="section-header">
        <h3 className="section-title">
          Bài viết chờ duyệt
          <span className="section-count">{props.draftPosts.length}</span>
        </h3>
        <PublishActions selectedCount={props.selectedPosts.size} loading={props.loading}
          onPublish={props.onPublish} onDelete={props.onDelete} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {props.draftPosts.map(p => (
          <PostCard key={p.id} post={p} selected={props.selectedPosts.has(p.id)}
            imageChoice={props.selectedImages[p.id]} editedContent={props.editedContent[p.id]}
            editedHashtags={props.editedHashtags[p.id]} onToggle={props.onTogglePost}
            onImageChoice={props.onImageChoice} onContentChange={props.onContentChange}
            onHashtagsChange={props.onHashtagsChange}
            onRegenerateImage={props.onRegenerateImage}
            regenerating={props.regeneratingIds.has(p.id)} />
        ))}
        {props.draftPosts.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✍️</div>
            <p>Chưa có bài viết nào. Quay lại bước 2 để tạo bài.</p>
          </div>
        )}
      </div>

      {props.publishedPosts.length > 0 && <PostHistory posts={props.publishedPosts} />}
    </div>
  );
}
