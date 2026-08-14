'use client';

import { useState, useEffect } from 'react';
import { notifyError, notifySuccess, confirmDialog } from '@/components/ui/Notify';
import { Stepper } from '@/components/layout/Stepper';
import { StepResearch } from '@/components/pipeline/StepResearch';
import { StepSelectArticles } from '@/components/pipeline/StepSelectArticles';
import { StepReviewPublish } from '@/components/pipeline/StepReviewPublish';
import { useArticles } from '@/hooks/useArticles';
import { usePosts } from '@/hooks/usePosts';
import type { SourceFilter, PostTarget } from '@/types';
import { DEFAULT_SCHEDULE_INTERVAL_HOURS } from '@/lib/constants';

export default function PipelinePage() {
  const [step, setStep] = useState(1);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [researchLoading, setResearchLoading] = useState(false);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleInterval, setScheduleInterval] = useState(DEFAULT_SCHEDULE_INTERVAL_HOURS);
  const [createVideo, setCreateVideo] = useState(false);
  const [targetPageIds, setTargetPageIds] = useState<string[]>([]);
  const [targetGroupIds, setTargetGroupIds] = useState<string[]>([]);

  const articles = useArticles();
  const posts = usePosts();

  useEffect(() => {
    if (step === 2) articles.fetchArticles(sourceFilter);
    if (step === 3) {
      posts.fetchPosts();
      if (!scheduleStart) {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
        const pad = (n: number) => String(n).padStart(2, '0');
        const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setScheduleStart(local);
      }
    }
  }, [step]);

  const handleResearch = async () => {
    setResearchLoading(true);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceFilter }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        notifyError(data.error || 'Cào dữ liệu thất bại. Kiểm tra nguồn tin & cấu hình.');
        return; // ở lại bước 1, KHÔNG sang bước 2
      }
      notifySuccess(typeof data.count === 'number' ? `Đã quét ${data.count} tin mới.` : 'Đã quét tin mới.');
      setStep(2);
    } catch (err) {
      notifyError('Lỗi kết nối mạng khi cào dữ liệu!');
    } finally {
      setResearchLoading(false);
    }
  };

  const handleBatchWrite = async () => {
    const success = await articles.batchWrite();
    if (success) setStep(3);
  };

  const handlePublish = async (target: PostTarget) => {
    // Xác nhận cho các đích fan-out (đăng nhiều nơi, khó thu hồi).
    const n = posts.selectedPosts.size;
    if (target === 'all' || target === 'groups' || (target === 'page' && targetPageIds.length > 1)) {
      const where = target === 'all'
        ? `TẤT CẢ đích (Page + Nhóm)`
        : target === 'groups'
          ? `${targetGroupIds.length} nhóm`
          : `${targetPageIds.length} Page`;
      const okc = await confirmDialog(`Đăng ${n} bài lên ${where}? Thao tác này khó thu hồi.`, {
        title: 'Xác nhận đăng', confirmText: 'Đăng',
      });
      if (!okc) return;
    }
    posts.batchSchedule(target, scheduleStart, scheduleInterval, createVideo, {
      pageId: targetPageIds[0],
      pageIds: targetPageIds,
      groupIds: targetGroupIds,
    });
  };

  return (
    <>
      <Stepper current={step} onChange={setStep} />

      {step === 1 && (
        <StepResearch
          sourceFilter={sourceFilter}
          onFilterChange={setSourceFilter}
          onResearch={handleResearch}
          loading={researchLoading}
        />
      )}

      {step === 2 && (
        <StepSelectArticles
          articles={articles.newArticles}
          selectedArticles={articles.selectedArticles}
          selectedFormat={articles.selectedFormat}
          loading={articles.loading}
          onToggle={articles.toggleSelection}
          onSetFormat={articles.setFormat}
          onBatchWrite={handleBatchWrite}
        />
      )}

      {step === 3 && (
        <StepReviewPublish
          draftPosts={posts.draftPosts}
          publishedPosts={posts.publishedPosts}
          selectedPosts={posts.selectedPosts}
          selectedImages={posts.selectedImages}
          editedContent={posts.editedContent}
          editedHashtags={posts.editedHashtags}
          loading={posts.loading}
          scheduleStart={scheduleStart}
          scheduleInterval={scheduleInterval}
          createVideo={createVideo}
          onScheduleStartChange={setScheduleStart}
          onScheduleIntervalChange={setScheduleInterval}
          onCreateVideoChange={setCreateVideo}
          onTogglePost={posts.toggleSelection}
          onImageChoice={posts.setImageChoice}
          onContentChange={posts.updateContent}
          onHashtagsChange={posts.updateHashtags}
          onRegenerateImage={posts.regenerateImage}
          regeneratingIds={posts.regeneratingIds}
          onPublish={handlePublish}
          onDelete={posts.deleteSelected}
          targetPageIds={targetPageIds}
          targetGroupIds={targetGroupIds}
          onTargetPagesChange={setTargetPageIds}
          onTargetGroupsChange={setTargetGroupIds}
        />
      )}
    </>
  );
}
