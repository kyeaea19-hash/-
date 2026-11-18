import React from 'react';
import { TabId } from '../types/powerplant';

export const BottomNav: React.FC<{
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
}> = ({ activeTab, onSelectTab }) => {
  return (
    <nav className="fixed bottom-0 w-full z-40 pb-safe bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_-4px_16px_rgba(11,28,48,0.05)]">
      <div className="flex justify-around items-center h-16 max-w-[680px] mx-auto px-space-xs">
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          aria-current={activeTab === 'home' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-primary-container font-bold'
              : 'text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">energy_savings_leaf</span>
          <span className="font-label-sm text-label-sm mt-0.5">홈</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('news')}
          aria-current={activeTab === 'news' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition-all cursor-pointer ${
            activeTab === 'news'
              ? 'text-primary-container font-bold'
              : 'text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">newspaper</span>
          <span className="font-label-sm text-label-sm mt-0.5">뉴스</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('write')}
          aria-current={activeTab === 'write' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition-all cursor-pointer ${
            activeTab === 'write'
              ? 'text-primary-container font-bold'
              : 'text-secondary hover:text-on-surface'
          }`}
        >
          <div className="w-10 h-10 -mt-4 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-[0_6px_16px_rgba(255,94,30,0.35)]">
            <span className="material-symbols-outlined text-[22px]">edit_note</span>
          </div>
          <span className="font-label-sm text-label-sm mt-0.5">일기쓰기</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('calendar')}
          aria-current={activeTab === 'calendar' ? 'page' : undefined}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 transition-all cursor-pointer ${
            activeTab === 'calendar'
              ? 'text-primary-container font-bold'
              : 'text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">calendar_month</span>
          <span className="font-label-sm text-label-sm mt-0.5">기록달력</span>
        </button>
      </div>
    </nav>
  );
};
