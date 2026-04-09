import React, { useState } from 'react';
import { upsertGoals } from '../utils/db';

export default function Onboarding({ userId, onComplete }) {
  const [goals, setGoals] = useState({
    calories: 2000,
    protein: 120,
    carbs: 200,
    fat: 65,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertGoals(userId, goals);
      onComplete();
    } catch (err) {
      alert('Could not save goals: ' + err.message);
    }
    setSaving(false);
  };

  const update = (key, val) => {
    setGoals(prev => ({ ...prev, [key]: Math.max(0, parseInt(val) || 0) }));
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: 24, background: 'var(--cream)',
      maxWidth: 480, margin: '0 auto',
    }}>
      <div className="fade-in" style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontSize: 48, marginBottom: 8, lineHeight: 1,
          fontFamily: 'var(--font-display)', fontWeight: 800,
          color: 'var(--sage-dark)',
        }}>
          Nourish
        </div>
        <p style={{ color: 'var(--text-light)', fontSize: 18 }}>
          Your personal meal command center
        </p>
      </div>

      <div className="card fade-in" style={{ animationDelay: '0.1s' }}>
        <h2 style={{ marginBottom: 4 }}>Set Your Daily Goals</h2>
        <p style={{ color: 'var(--text-light)', fontSize: 16, marginBottom: 24 }}>
          You can always change these later in Settings.
        </p>

        <div className="form-group">
          <label className="form-label">Daily Calories</label>
          <input
            type="number"
            value={goals.calories}
            onChange={e => update('calories', e.target.value)}
            min="0" step="50"
            style={{ fontSize: 22, fontWeight: 600, textAlign: 'center' }}
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
                type="number"
                value={goals[key]}
                onChange={e => update(key, e.target.value)}
                min="0"
                style={{ textAlign: 'center', fontWeight: 600 }}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        className="btn btn-primary btn-full fade-in"
        style={{ animationDelay: '0.2s', marginTop: 8, fontSize: 20 }}
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? 'Saving...' : "Let's Get Started"}
      </button>
    </div>
  );
}
