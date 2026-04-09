import React, { useState, useEffect, useRef } from 'react';
import { fetchGoals, upsertGoals } from '../utils/db';
import MacroGoalEditor from '../components/MacroGoalEditor';

export default function SettingsScreen({ userId, onClose, onSignOut }) {
  const [goals, setGoals] = useState({ calories: 2000, protein: 120, carbs: 200, fat: 65 });
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    fetchGoals(userId).then(g => { setGoals(g); setLoaded(true); }).catch(() => setLoaded(true));
  }, [userId]);

  const handleChange = (newGoals) => {
    setGoals(newGoals);
    // Debounce save
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      upsertGoals(userId, newGoals).catch(() => {});
    }, 500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {loaded && (
          <>
            <MacroGoalEditor goals={goals} onChange={handleChange} />
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginTop: 12, marginBottom: 24 }}>
              Changes save automatically.
            </p>
          </>
        )}

        <button
          className="btn btn-secondary btn-full"
          onClick={onSignOut}
          style={{ marginTop: 8 }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
