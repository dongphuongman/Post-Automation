import { useState, useCallback } from 'react';
import type { Post, PostTarget, ImageType, PublishPayload, PublishTarget } from '@/types';
import { MIN_SCHEDULE_AHEAD_MINUTES } from '@/lib/constants';
import { notify, notifyError, notifySuccess, confirmDialog } from '@/components/ui/Notify';

export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [selectedImages, setSelectedImages] = useState<Record<string, ImageType>>({});
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [editedHashtags, setEditedHashtags] = useState<Record<string, string>>({});
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

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

  // Tạo lại ảnh AI cho 1 bài (retry khi lần tạo lúc viết bài bị null). Cập nhật ngay
  // generated_image_url trong state để UI đổi ảnh mà không cần refetch toàn bộ.
  const regenerateImage = useCallback(async (id: string) => {
    setRegeneratingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch('/api/regenerate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      });
      const data = await res.json();
      if (!data.success) { notifyError(data.error || 'Không tạo được ảnh'); return; }
      setPosts(prev => prev.map(p => p.id === id ? { ...p, generated_image_url: data.generated_image_url } : p));
      setSelectedImages(prev => ({ ...prev, [id]: 'generated' }));
      notifySuccess('Đã tạo lại ảnh AI cho bài viết.');
    } catch {
      notifyError('Lỗi mạng khi tạo lại ảnh');
    } finally {
      setRegeneratingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  }, []);

  const batchSchedule = useCallback(async (
    postTarget: PostTarget,
    scheduleStart: string,
    scheduleInterval: number,
    createVideo: boolean,
    target?: PublishTarget,
  ) => {
    if (selectedPosts.size === 0) {
      notify('Vui lòng chọn ít nhất 1 bài để đăng!', 'warning');
      return;
    }

    // Với đích Page/Nhóm/Tất cả cần chọn Page đích (bot đăng theo Page đó).
    if ((postTarget === 'page' || postTarget === 'groups' || postTarget === 'all') && !target?.pageId) {
      notify('Vui lòng chọn Page đích ở phần "Đích đăng"!', 'warning');
      return;
    }

    // Instagram BẮT BUỘC có ảnh: chặn nếu bài đã chọn không có ảnh nào (chọn/tạo/gốc).
    if (postTarget === 'instagram') {
      const missing = Array.from(selectedPosts).filter(id => {
        const p = posts.find(x => x.id === id);
        if (!p) return false;
        return !(p.selected_image_url || p.generated_image_url || p.original_image_url);
      });
      if (missing.length) {
        notify(`Instagram bắt buộc phải có ảnh! ${missing.length} bài đang chọn không có ảnh — vui lòng bỏ chọn hoặc thêm ảnh trước khi đăng.`, 'warning');
        return;
      }
    }

    const needsSchedule = postTarget === 'page' || postTarget === 'all' || postTarget === 'profile'
      || postTarget === 'x' || postTarget === 'threads' || postTarget === 'instagram';
    if (needsSchedule && !scheduleStart) {
      notify('Vui lòng chọn giờ bắt đầu đăng!', 'warning');
      return;
    }

    let currentScheduleTime = scheduleStart ? new Date(scheduleStart).getTime() : 0;
    // Ngưỡng "cách hiện tại ≥ N phút" là quy định Facebook cho bài hẹn lịch qua Graph
    // API — chỉ áp cho đích 'page'/'all'. Group/cá nhân/X/Threads/Instagram do bot tự
    // đăng (gate scheduled_time <= now) nên cho phép hẹn gần hơn.
    const graphScheduled = postTarget === 'page' || postTarget === 'all';
    if (graphScheduled && scheduleStart) {
      const minAhead = Date.now() + MIN_SCHEDULE_AHEAD_MINUTES * 60 * 1000;
      if (currentScheduleTime < minAhead) {
        notify(`Theo quy định Facebook, giờ hẹn phải cách hiện tại ít nhất ${MIN_SCHEDULE_AHEAD_MINUTES} phút!`, 'warning');
        return;
      }
    }

    setLoading(true);
    let successCount = 0;
    let lastError = '';

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
        targetPageIds: target?.pageIds,
        targetGroupIds: target?.groupIds,
      };

      if ((postTarget === 'page' || postTarget === 'all' || postTarget === 'reels' || postTarget === 'profile'
        || postTarget === 'x' || postTarget === 'threads' || postTarget === 'instagram') && currentScheduleTime > 0) {
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
        else lastError = data.error || lastError;
      } catch (err) {
        console.error(err);
        lastError = 'Lỗi mạng';
      }

      if (needsSchedule && currentScheduleTime > 0) {
        currentScheduleTime += scheduleInterval * 60 * 60 * 1000;
      }
    }

    setLoading(false);
    const labels: Record<PostTarget, string> = {
      page: 'lên lịch Facebook Page',
      profile: 'đăng trang cá nhân',
      groups: 'đăng hội nhóm',
      reels: 'tạo Video Reels',
      all: 'đăng tất cả',
      x: 'đăng lên X',
      threads: 'đăng lên Threads',
      instagram: 'đăng lên Instagram',
    };
    const total = selectedPosts.size;
    if (successCount === 0) {
      notifyError(`Không ${labels[postTarget]} được bài nào${lastError ? `: ${lastError}` : ''}.`);
    } else if (successCount < total) {
      notify(`Đã ${labels[postTarget]} ${successCount}/${total} bài — ${total - successCount} bài lỗi${lastError ? `: ${lastError}` : ''}.`, 'warning');
    } else {
      notifySuccess(`Đã ${labels[postTarget]} thành công ${successCount}/${total} bài viết!`);
    }
    setSelectedPosts(new Set());
    fetchPosts();
  }, [selectedPosts, selectedImages, editedContent, editedHashtags, posts, fetchPosts]);

  const deleteSelected = useCallback(async () => {
    const ids = Array.from(selectedPosts);
    if (ids.length === 0) {
      notify('Vui lòng chọn ít nhất 1 bài để xoá!', 'warning');
      return;
    }
    if (!(await confirmDialog(`Bạn có chắc muốn xoá vĩnh viễn ${ids.length} bài viết đã chọn?`, { title: 'Xoá bài viết', confirmText: 'Xoá', danger: true }))) return;

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
    regeneratingIds,
    fetchPosts,
    toggleSelection,
    setImageChoice,
    updateContent,
    updateHashtags,
    regenerateImage,
    batchSchedule,
    deleteSelected,
  };
}
