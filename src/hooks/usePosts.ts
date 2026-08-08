import { useState, useCallback } from 'react';
import type { Post, PostTarget, ImageType, PublishPayload, PublishTarget } from '@/types';
import { MIN_SCHEDULE_AHEAD_MINUTES } from '@/lib/constants';

export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Record<string, ImageType>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editedHashtags, setEditedHashtags] = useState<Record<string, string>>({});

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      setPosts(data.posts || []);
    } catch {
      console.error('Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedPosts(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setSelectedImages(imgs => imgs[id] ? imgs : { ...imgs, [id]: 'generated' });
      }
      return next;
    });
  }, []);

  const setImageChoice = useCallback((id: string, type: ImageType) => {
    setSelectedImages(prev => ({ ...prev, [id]: type }));
  }, []);

  const updateContent = useCallback((id: string, content: string) => {
    setEditedContent(prev => ({ ...prev, [id]: content }));
  }, []);

  const updateHashtags = useCallback((id: string, hashtags: string) => {
    setEditedHashtags(prev => ({ ...prev, [id]: hashtags }));
  }, []);

  const batchSchedule = useCallback(async (
    postTarget: PostTarget,
    scheduleStart: string,
    scheduleInterval: number,
    createVideo: boolean,
    target?: PublishTarget,
  ) => {
    if (selectedPosts.size === 0) {
      alert('Vui lòng chọn ít nhất 1 bài để đăng!');
      return;
    }

    // Với đích Page/Nhóm/Tất cả cần chọn Page đích (bot đăng theo Page đó).
    if ((postTarget === 'page' || postTarget === 'groups' || postTarget === 'all') && !target?.pageId) {
      alert('Vui lòng chọn Page đích ở phần "Đích đăng"!');
      return;
    }

    const needsSchedule = postTarget === 'page' || postTarget === 'all';
    if (needsSchedule && !scheduleStart) {
      alert('Vui lòng chọn giờ bắt đầu đăng!');
      return;
    }

    let currentScheduleTime = scheduleStart ? new Date(scheduleStart).getTime() : 0;
    if (needsSchedule && scheduleStart) {
      const minAhead = Date.now() + MIN_SCHEDULE_AHEAD_MINUTES * 60 * 1000;
      if (currentScheduleTime < minAhead) {
        alert(`Theo quy định Facebook, giờ hẹn phải cách hiện tại ít nhất ${MIN_SCHEDULE_AHEAD_MINUTES} phút!`);
        return;
      }
    }

    setLoading(true);
    let successCount = 0;

    for (const id of selectedPosts) {
      const p = posts.find(x => x.id === id);
      if (!p) continue;

      const payload: PublishPayload = {
        postId: id,
        imageType: selectedImages[id] || 'generated',
        postTarget,
        createVideo: postTarget === 'reels' ? true : createVideo,
        overrideContent: editedContent[id] ?? undefined,
        overrideHashtags: editedHashtags[id] ?? undefined,
        targetPageId: target?.pageId,
        targetGroupIds: target?.groupIds,
      };

      if ((postTarget === 'page' || postTarget === 'all' || postTarget === 'reels') && currentScheduleTime > 0) {
        payload.scheduledTime = Math.floor(currentScheduleTime / 1000);
      }

      try {
        const res = await fetch('/api/post-facebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) successCount++;
      } catch (err) {
        console.error(err);
      }

      if (needsSchedule && currentScheduleTime > 0) {
        currentScheduleTime += scheduleInterval * 60 * 60 * 1000;
      }
    }

    setLoading(false);
    const labels: Record<PostTarget, string> = {
      page: 'lên lịch Facebook Page',
      groups: 'đăng hội nhóm',
      reels: 'tạo Video Reels',
      all: 'đăng tất cả',
    };
    alert(`Đã ${labels[postTarget]} thành công ${successCount}/${selectedPosts.size} bài viết!`);
    setSelectedPosts(new Set());
    fetchPosts();
  }, [selectedPosts, selectedImages, editedContent, editedHashtags, posts, fetchPosts]);

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedPosts);
    if (ids.length === 0) {
      alert('Vui lòng chọn ít nhất 1 bài để xoá!');
      return;
    }
    if (!confirm(`Bạn có chắc muốn xoá vĩnh viễn ${ids.length} bài viết đã chọn?`)) return;

    setLoading(true);
    await fetch('/api/posts/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setLoading(false);
    setSelectedPosts(new Set());
    fetchPosts();
  }, [selectedPosts, fetchPosts]);

  const draftPosts = posts.filter(p => p.status === 'draft');
  const publishedPosts = posts.filter(p => ['posted', 'ready_for_groups', 'groups_posted'].includes(p.status));

  return {
    posts,
    draftPosts,
    publishedPosts,
    loading,
    selectedPosts,
    selectedImages,
    editedContent,
    editedHashtags,
    fetchPosts,
    toggleSelection,
    setImageChoice,
    updateContent,
    updateHashtags,
    batchSchedule,
    deleteSelected,
  };
}
