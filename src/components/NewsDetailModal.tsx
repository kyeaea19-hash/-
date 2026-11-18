import React, { useEffect, useState } from 'react';
import { usePowerPlant } from '../context/PowerPlantContext';
import { NewsArticle, VALIDATION_LIMITS } from '../types/powerplant';
import { NewsVisualBanner } from './PowerPlantEmblem';

export const NewsDetailModal: React.FC<{
  article: NewsArticle | null;
  onClose: () => void;
}> = ({ article, onClose }) => {
  const { todayNewsMemo, saveTodayNewsMemo } = usePowerPlant();
  const [memoText, setMemoText] = useState(todayNewsMemo);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!article) return;
    setMemoText(todayNewsMemo);
    setSavedNotice(false);
    setSaveError(null);
  }, [article?.id, todayNewsMemo]);

  if (!article) return null;

  const isDirty = memoText.trim() !== todayNewsMemo.trim();
  const shortArticleTitle =
    article.title.length > 26 ? `${article.title.slice(0, 26)}…` : article.title;
  const articleTag = `[${article.company}] ${shortArticleTitle}`;
  const hasArticleTag = memoText.includes(articleTag);

  const handleInsertArticleTag = () => {
    setSavedNotice(false);
    setSaveError(null);
    setMemoText((prev) => {
      const trimmed = prev.trimEnd();
      const addition = `${articleTag}\n- `;
      const next = trimmed ? `${trimmed}\n\n${addition}` : addition;
      return next.slice(0, VALIDATION_LIMITS.newsMemoMax);
    });
  };

  const handleSaveMemo = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveTodayNewsMemo(memoText);
      setMemoText((prev) => prev.trim());
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2400);
    } catch {
      setSaveError('메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-on-surface/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] max-h-[88dvh] overflow-y-auto bg-surface-container-lowest rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-on-surface text-surface font-label-sm text-label-sm font-bold">
              {article.company}
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
              {article.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-secondary hover:text-on-surface cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="space-y-1">
          <h3 className="font-headline-md text-headline-md text-on-surface leading-snug">
            {article.title}
          </h3>
          <p className="font-body-sm text-body-sm text-secondary">{article.subtitle}</p>
        </div>

        <NewsVisualBanner theme={article.visualTheme} caption={article.visualCaption} />

        {article.intro && (
          <p className="font-body-md text-body-md text-on-surface leading-relaxed">
            {article.intro}
          </p>
        )}

        <div className="p-4 rounded-xl bg-surface-container-low space-y-2.5">
          <div className="font-label-md text-label-md text-primary font-bold">
            핵심 3줄 브리핑 요약
          </div>
          {article.bullets.map((b, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-primary-container/15 text-primary font-label-sm text-label-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <p className="font-body-sm text-body-sm text-on-surface leading-relaxed">{b}</p>
            </div>
          ))}
        </div>

        {article.interviewTip && (
          <div className="rounded-xl bg-tertiary-fixed/35 p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            </div>
            <div>
              <span className="font-label-md text-label-md text-tertiary font-bold">
                면접 · 자소서 연결 포인트
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed mt-0.5">
                {article.interviewTip}
              </p>
            </div>
          </div>
        )}

        {/* Compact Interview & News Memo Box */}
        <div className="rounded-xl bg-surface-container-low p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="news-interview-memo"
              className="flex items-center gap-1.5 font-label-md text-label-md text-on-surface font-bold"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">edit_note</span>
              나만의 면접 · 기사 메모
            </label>
            {!hasArticleTag && (
              <button
                type="button"
                onClick={handleInsertArticleTag}
                className="px-2 py-0.5 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-semibold hover:bg-primary-fixed transition-colors cursor-pointer shrink-0"
              >
                + 기사 제목 넣기
              </button>
            )}
          </div>

          <textarea
            id="news-interview-memo"
            rows={3}
            maxLength={VALIDATION_LIMITS.newsMemoMax}
            value={memoText}
            onChange={(e) => {
              setMemoText(e.target.value);
              if (savedNotice) setSavedNotice(false);
              if (saveError) setSaveError(null);
            }}
            placeholder="면접 예상 질문, 자소서 연결 포인트, 기억할 핵심 키워드를 가볍게 메모해 보세요."
            className="w-full bg-surface-container-lowest text-on-surface font-body-sm text-body-sm rounded-lg p-2.5 focus:outline-none placeholder:text-secondary/60 leading-relaxed shadow-inner resize-y"
          />

          {saveError && (
            <p className="font-label-sm text-label-sm text-error">{saveError}</p>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-label-sm text-label-sm text-secondary">
              {savedNotice
                ? '저장 완료 · 오늘 일기와 기록달력에 반영되었어요'
                : '오늘 일기에 함께 저장 · 기록달력 회고 아래에 표시돼요'}
            </span>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <span className="font-label-sm text-label-sm text-secondary">
                {memoText.length}/{VALIDATION_LIMITS.newsMemoMax}
              </span>
              <button
                type="button"
                onClick={handleSaveMemo}
                disabled={saving || (!isDirty && !savedNotice && memoText.trim().length === 0)}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm font-bold transition-all cursor-pointer disabled:opacity-60 ${
                  savedNotice && !isDirty
                    ? 'bg-tertiary-container text-on-tertiary'
                    : 'bg-primary-container text-on-primary shadow-xs hover:opacity-95'
                }`}
              >
                {saving ? '저장 중...' : savedNotice && !isDirty ? '저장됨 ✓' : '메모 저장'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
          <span className="font-label-sm text-label-sm text-secondary">{article.sourceName}</span>
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-primary-container text-on-primary font-label-md text-label-md font-bold shadow-sm hover:opacity-95"
          >
            <span>원문 기사 / 출처 보기</span>
            <span className="material-symbols-outlined text-[16px]">north_east</span>
          </a>
        </div>
      </div>
    </div>
  );
};
