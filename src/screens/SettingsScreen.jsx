import React, { useState, useEffect } from 'react';
import { fetchGoals, upsertGoals } from '../utils/db';

export default function SettingsScreen({ userId, onClose, onSignOut }) {
  const [goals, setGoals] = useState({ calories: 2000, protein: 120, carbs: 200, fat: 65 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchGoals(userId).then(g => { setGoals(g); setLoaded(true); }).catch(() => setLoaded(true));
  }, [userId]);

  const update = (key, val) => {
    const newGoals = { ...goals, [key]: Math.max(0, parseInt(val) || 0) };
    setGoals(newGoals);
    upsertGoals(userId, newGoals).catch(() => {});
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <h3 style={{ marginBottom: 16 }}>Daily Macro Goals</h3>

        {loaded && (
          <>
            <div className="form-group">
              <label className="form-label">Daily Calories</label>
              <input
                type="number" value={goals.calories}
                onChange={e => update('calories', e.target.value)}
                min="0" step="50"
                style={{ fontSize: 20, fontWeight: 600, textAlign: 'center' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { key: 'protein', label: 'Protein (g)' },
                { key: 'carbs', label: 'Carbs (g)' },
                { key: 'fat', label: 'Fat (g)' },
              ].map(({ key, label }) => (
                <div className="form-group" key={key}>
                  <label className="form-label" style={{ textAlign: 'center' }}>{label}</label>
                  <input
                    type="number" value={goals[key]}
                    onChange={e => update(key, e.target.value)}
                    min="0" style={{ textAlign: 'center', fontWeight: 600 }}
                  />
                </div>
              ))}
            </div>

            <p style={{ fontSize: 14, color: 'var(--text-light)', marginTop: 8, marginBottom: 24 }}>
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
