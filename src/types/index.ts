export interface Article {
  id: string;
  source_id: string;
  title: string;
  url: string;
  summary: string;
  original_image_url: string | null;
  published_at: string;
  status: 'new' | 'written';
  format: ArticleFormat | null;
  created_at: string;
  source_name: string;
  source_type: string;
}

export interface Post {
  id: string;
  article_id: string;
  format: 'pov' | 'info';
  content: string;
  hashtags: string;
  generated_image_url: string | null;
  original_image_url: string | null;
  facebook_post_id: string | null;
  scheduled_time: number | null;
  status: 'draft' | 'posted' | 'ready_for_groups' | 'groups_posted';
  created_at: string;
  create_video: boolean;
  video_status: 'none' | 'pending' | 'completed';
  selected_image_url: string | null;
  article_title: string;
  article_url: string;
}

export type SourceFilter = 'all' | 'news' | 'x' | 'instagram';
export type PostTarget = 'page' | 'groups' | 'all' | 'reels';
export type ImageType = 'original' | 'generated';
export type ArticleFormat = 'pov' | 'info';

export interface PublishPayload {
  postId: string;
  imageType: ImageType;
  postTarget: PostTarget;
  createVideo: boolean;
  overrideContent?: string;
  overrideHashtags?: string;
  scheduledTime?: number;
  targetPageId?: string;
  targetGroupIds?: string[];
}

export interface PublishTarget {
  pageId?: string;
  groupIds?: string[];
}

