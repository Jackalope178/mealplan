import { useState, useEffect, useCallback } from 'react';
import { supabase } from './utils/supabaseClient';
import TabBar from './components/TabBar';
import AuthScreen from './screens/AuthScreen';
import Onboarding from './screens/Onboarding';
import HomeScreen from './screens/HomeScreen';
import RecipesScreen from './screens/RecipesScreen';
import FoodsScreen from './screens/FoodsScreen';
import PlanScreen from './screens/PlanScreen';
import LogScreen from './screens/LogScreen';
import SettingsScreen from './screens/SettingsScreen';
import { fetchGoals } from './utils/db';

function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = no auth
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Listen to auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) checkOnboarding(s.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) checkOnboarding(s.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkOnboarding = async (userId) => {
    try {
      const goals = await fetchGoals(userId);
      // If goals are still exact defaults, user hasn't set them yet
      if (goals.calories === 2000 && goals.protein === 120 && goals.carbs === 200 && goals.fat === 65) {
        // Check if a row actually exists
        const { data } = await supabase.from('goals').select('id').eq('user_id', userId).maybeSingle();
        if (!data) {
          setNeedsOnboarding(true);
          return;
        }
      }
      setNeedsOnboarding(false);
    } catch {
      setNeedsOnboarding(false);
    }
  };

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setRefreshKey(k => k + 1);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // Loading state
  if (session === undefined) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cream)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 48, fontFamily: 'var(--font-display)', fontWeight: 800,
            color: 'var(--sage-dark)', marginBottom: 12,
          }}>
            Nourish
          </div>
          <p style={{ color: 'var(--text-light)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return <AuthScreen />;
  }

  const userId = session.user.id;
  const userName = session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || '';

  // Onboarding
  if (needsOnboarding) {
    return (
      <Onboarding
        userId={userId}
        onComplete={() => setNeedsOnboarding(false)}
      />
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'home':
        return <HomeScreen key={refreshKey} userId={userId} userName={userName} onNavigate={handleTabChange} />;
      case 'recipes':
        return <RecipesScreen key={refreshKey} userId={userId} />;
      case 'foods':
        return <FoodsScreen key={refreshKey} userId={userId} />;
      case 'plan':
        return <PlanScreen key={refreshKey} userId={userId} />;
      case 'log':
        return <LogScreen key={refreshKey} userId={userId} />;
      default:
        return <HomeScreen key={refreshKey} userId={userId} userName={userName} onNavigate={handleTabChange} />;
    }
  };

  return (
    <div className="app-container">
      {/* Settings gear */}
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
      {showSettings && (
        <SettingsScreen
          userId={userId}
          onClose={() => { setShowSettings(false); setRefreshKey(k => k + 1); }}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}

export default App;
