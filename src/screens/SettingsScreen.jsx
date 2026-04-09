import React, { useState } from 'react';
import { getGoals, saveGoals } from '../utils/storage';

export default function SettingsScreen({ onClose }) {
  const [goals, setGoals] = useState(getGoals());

  const update = (key, val) => {
    const newGoals = { ...goals, [key]: Math.max(0, parseInt(val) || 0) };
    setGoals(newGoals);
    saveGoals(newGoals);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <h3 style={{ marginBottom: 16 }}>Daily Macro Goals</h3>

        <div className="form-group">
          <label className="form-label">Daily Calories</label>
          <input
            type="number"
            value={goals.calories}
            onChange={e => update('calories', e.target.value)}
            min="0" step="50"
            style={{ fontSize: 20, fontWeight: 600, textAlign: 'center' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'center' }}>Protein (g)</label>
            <input
              type="number" value={goals.protein}
              onChange={e => update('protein', e.target.value)}
              min="0" style={{ textAlign: 'center', fontWeight: 600 }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'center' }}>Carbs (g)</label>
            <input
              type="number" value={goals.carbs}
              onChange={e => update('carbs', e.target.value)}
              min="0" style={{ textAlign: 'center', fontWeight: 600 }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ textAlign: 'center' }}>Fat (g)</label>
            <input
              type="number" value={goals.fat}
              onChange={e => update('fat', e.target.value)}
              min="0" style={{ textAlign: 'center', fontWeight: 600 }}
            />
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-light)', marginTop: 8 }}>
          Changes save automatically.
        </p>
      </div>
    </div>
  );
}
