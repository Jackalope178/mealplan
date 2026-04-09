import React, { useState } from 'react';
import { upsertGoals } from '../utils/db';
import MacroGoalEditor from '../components/MacroGoalEditor';

export default function Onboarding({ userId, onComplete }) {
  const [goals, setGoals] = useState({
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 67,
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

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: 24, background: 'var(--cream)',
      maxWidth: 480, margin: '0 auto', overflowY: 'auto',
    }}>
      <div className="fade-in" style={{ textAlign: 'center', marginBottom: 32 }}>
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
        <p style={{ color: 'var(--text-light)', fontSize: 16, marginBottom: 20 }}>
          Pick your calorie target and a macro split. You can always change these later.
        </p>
        <MacroGoalEditor goals={goals} onChange={setGoals} />
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
