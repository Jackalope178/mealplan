import { useState, useCallback } from 'react';
import { isOnboarded } from './utils/storage';
import TabBar from './components/TabBar';
import Onboarding from './screens/Onboarding';
import HomeScreen from './screens/HomeScreen';
import RecipesScreen from './screens/RecipesScreen';
import PlanScreen from './screens/PlanScreen';
import LogScreen from './screens/LogScreen';
import SettingsScreen from './screens/SettingsScreen';

function App() {
  const [onboarded, setOnboarded] = useState(isOnboarded());
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);
  // Force re-render key when switching tabs to refresh data
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setRefreshKey(k => k + 1);
  }, []);

  if (!onboarded) {
    return <Onboarding onComplete={() => setOnboarded(true)} />;
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen key={refreshKey} onNavigate={handleTabChange} />;
      case 'recipes':
        return <RecipesScreen key={refreshKey} />;
      case 'plan':
        return <PlanScreen key={refreshKey} />;
      case 'log':
        return <LogScreen key={refreshKey} />;
      default:
        return <HomeScreen key={refreshKey} onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="app-container">
      {/* Settings gear in top right */}
      <button
        onClick={() => setShowSettings(true)}
        style={{
          position: 'fixed', top: 16, right: 'calc(50% - 220px)',
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--white)', border: '1px solid var(--cream-dark)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
        aria-label="Settings"
        title="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>

      {renderScreen()}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />
      {showSettings && <SettingsScreen onClose={() => { setShowSettings(false); setRefreshKey(k => k + 1); }} />}
    </div>
  );
}

export default App;
