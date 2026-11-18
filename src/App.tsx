import React, { useEffect, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeDashboard } from './components/HomeDashboard';
import { NewsBriefsView } from './components/NewsBriefsView';
import { OnboardingScreen } from './components/OnboardingScreen';
import { RecordCalendarView } from './components/RecordCalendarView';
import { WriteDiaryView } from './components/WriteDiaryView';
import { PowerPlantProvider, usePowerPlant } from './context/PowerPlantContext';
import { TabId } from './types/powerplant';

const AppShell: React.FC = () => {
  const { mode, currentDate } = usePowerPlant();
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [diaryTargetDate, setDiaryTargetDate] = useState<string>(currentDate);
  const prevDateRef = useRef<string>(currentDate);

  useEffect(() => {
    if (prevDateRef.current !== currentDate) {
      if (diaryTargetDate === prevDateRef.current) {
        setDiaryTargetDate(currentDate);
      }
      prevDateRef.current = currentDate;
    }
  }, [currentDate, diaryTargetDate]);

  const handleSelectTab = (tab: TabId) => {
    if (tab === 'write') {
      setDiaryTargetDate(currentDate);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditDate = (dateStr: string) => {
    setDiaryTargetDate(dateStr);
    setActiveTab('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-3 p-6">
        <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-md animate-pulse">
          <span className="material-symbols-outlined text-[26px]">bolt</span>
        </div>
        <p className="font-label-md text-label-md text-secondary">
          발전소 전력망 상태를 불러오는 중...
        </p>
      </div>
    );
  }

  if (mode === 'unauthenticated') {
    return <OnboardingScreen />;
  }

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <AppHeader activeTab={activeTab} />
      <main className="flex-1 flex flex-col relative w-full px-margin pt-20 pb-24 bg-surface max-w-[680px] mx-auto">
        {activeTab === 'home' && <HomeDashboard onNavigate={handleSelectTab} />}
        {activeTab === 'news' && <NewsBriefsView />}
        {activeTab === 'write' && (
          <WriteDiaryView
            targetDate={diaryTargetDate}
            onSavedNavigate={handleSelectTab}
          />
        )}
        {activeTab === 'calendar' && (
          <RecordCalendarView
            initialDate={diaryTargetDate}
            onEditDate={handleEditDate}
            onNavigate={handleSelectTab}
          />
        )}
      </main>
      <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PowerPlantProvider>
        <AppShell />
      </PowerPlantProvider>
    </ErrorBoundary>
  );
}
