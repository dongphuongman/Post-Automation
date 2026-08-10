'use client';

import { useState, useEffect } from 'react';
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
  const [targetPageId, setTargetPageId] = useState('');
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
      await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceFilter }),
      });
      setStep(2);
    } catch (err) {
      alert('Lỗi kết nối mạng khi cào dữ liệu!');
    } finally {
      setResearchLoading(false);
    }
  };

  const handleBatchWrite = async () => {
    const success = await articles.batchWrite();
    if (success) setStep(3);
  };

  const handlePublish = (target: PostTarget) => {
    posts.batchSchedule(target, scheduleStart, scheduleInterval, createVideo, {
      pageId: targetPageId,
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
          onScheduleStartChange={setScheduleStart}
          onScheduleIntervalChange={setScheduleInterval}
          onTogglePost={posts.toggleSelection}
          onImageChoice={posts.setImageChoice}
          onContentChange={posts.updateContent}
          onHashtagsChange={posts.updateHashtags}
          onRegenerateImage={posts.regenerateImage}
          regeneratingIds={posts.regeneratingIds}
          onPublish={handlePublish}
          onDelete={posts.deleteSelected}
          targetPageId={targetPageId}
          targetGroupIds={targetGroupIds}
          onTargetPageChange={setTargetPageId}
          onTargetGroupsChange={setTargetGroupIds}
        />
      )}
    </>
  );
}
