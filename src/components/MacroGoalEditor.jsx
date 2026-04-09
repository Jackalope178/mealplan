import React, { useState, useEffect } from 'react';

// Calories per gram
const CAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

// Presets: name, description, ratio as { protein%, carbs%, fat% }
const PRESETS = [
  { id: 'balanced', name: 'Balanced', desc: 'General health', protein: 25, carbs: 50, fat: 25 },
  { id: 'zone', name: 'Zone', desc: 'Anti-inflammatory', protein: 30, carbs: 40, fat: 30 },
  { id: 'highProtein', name: 'High Protein', desc: 'Muscle building', protein: 40, carbs: 30, fat: 30 },
  { id: 'lowCarb', name: 'Low Carb', desc: 'Fewer carbs, more fat', protein: 40, carbs: 20, fat: 40 },
  { id: 'keto', name: 'Keto', desc: 'Very low carb', protein: 25, carbs: 5, fat: 70 },
];

function calcGrams(calories, proteinPct, carbsPct, fatPct) {
  return {
    protein: Math.round((proteinPct / 100 * calories) / CAL_PER_G.protein),
    carbs: Math.round((carbsPct / 100 * calories) / CAL_PER_G.carbs),
    fat: Math.round((fatPct / 100 * calories) / CAL_PER_G.fat),
  };
}

function detectPreset(calories, goals) {
  for (const p of PRESETS) {
    const g = calcGrams(calories, p.protein, p.carbs, p.fat);
    if (Math.abs(g.protein - goals.protein) <= 2 &&
        Math.abs(g.carbs - goals.carbs) <= 2 &&
        Math.abs(g.fat - goals.fat) <= 2) {
      return p.id;
    }
  }
  return 'custom';
}

export default function MacroGoalEditor({ goals, onChange }) {
  const [calories, setCalories] = useState(goals.calories);
  const [activePreset, setActivePreset] = useState(() =>
    detectPreset(goals.calories, goals)
  );
  const [customPct, setCustomPct] = useState({ protein: 30, carbs: 40, fat: 30 });
  const [isCustomEditing, setIsCustomEditing] = useState(false);

  // When a preset is tapped, recalculate grams
  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setIsCustomEditing(false);
    const grams = calcGrams(calories, preset.protein, preset.carbs, preset.fat);
    onChange({ calories, ...grams });
  };

  const goCustom = () => {
    setActivePreset('custom');
    setIsCustomEditing(true);
  };

  // When calories change, recalculate grams using current ratio
  const handleCaloriesChange = (val) => {
    const cal = Math.max(0, parseInt(val) || 0);
    setCalories(cal);

    if (activePreset !== 'custom') {
      const preset = PRESETS.find(p => p.id === activePreset);
      if (preset) {
        const grams = calcGrams(cal, preset.protein, preset.carbs, preset.fat);
        onChange({ calories: cal, ...grams });
        return;
      }
    }
    // Custom: use customPct
    const grams = calcGrams(cal, customPct.protein, customPct.carbs, customPct.fat);
    onChange({ calories: cal, ...grams });
  };

  // Custom: update one macro's grams directly
  const handleCustomGramChange = (key, val) => {
    const g = Math.max(0, parseInt(val) || 0);
    const newGoals = { ...goals, [key]: g, calories };
    onChange(newGoals);
  };

  // Derive current percentages for display
  const currentPct = {
    protein: calories > 0 ? Math.round((goals.protein * CAL_PER_G.protein / calories) * 100) : 0,
    carbs: calories > 0 ? Math.round((goals.carbs * CAL_PER_G.carbs / calories) * 100) : 0,
    fat: calories > 0 ? Math.round((goals.fat * CAL_PER_G.fat / calories) * 100) : 0,
  };

  return (
    <div>
      {/* Calories */}
      <div className="form-group">
        <label className="form-label">Daily Calories</label>
        <input
          type="number"
          value={calories}
          onChange={e => handleCaloriesChange(e.target.value)}
          min="0" step="50"
          style={{ fontSize: 22, fontWeight: 600, textAlign: 'center' }}
        />
      </div>

      {/* Presets */}
      <div className="form-group">
        <label className="form-label">Choose a Macro Split</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className={`btn btn-sm ${activePreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}
            >
              <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
                <div>{p.name}</div>
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 400 }}>
                  {p.protein}/{p.carbs}/{p.fat}
                </div>
              </div>
            </button>
          ))}
          <button
            onClick={goCustom}
            className={`btn btn-sm ${activePreset === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: '1 1 calc(50% - 4px)', minWidth: 0 }}
          >
            Custom
          </button>
        </div>
      </div>

      {/* Ratio bar visualization */}
      <div style={{
        display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden',
        height: 28, marginBottom: 16,
      }}>
        <div style={{
          width: `${currentPct.protein}%`, background: 'var(--protein-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 11, fontWeight: 700, minWidth: currentPct.protein > 8 ? 0 : 'auto',
        }}>
          {currentPct.protein > 8 && `P ${currentPct.protein}%`}
        </div>
        <div style={{
          width: `${currentPct.carbs}%`, background: 'var(--carb-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 11, fontWeight: 700,
        }}>
          {currentPct.carbs > 8 && `C ${currentPct.carbs}%`}
        </div>
        <div style={{
          width: `${currentPct.fat}%`, background: 'var(--fat-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 11, fontWeight: 700,
        }}>
          {currentPct.fat > 8 && `F ${currentPct.fat}%`}
        </div>
      </div>

      {/* Gram targets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {[
          { key: 'protein', label: 'Protein', color: 'var(--protein-color)', unit: 'g' },
          { key: 'carbs', label: 'Carbs', color: 'var(--carb-color)', unit: 'g' },
          { key: 'fat', label: 'Fat', color: 'var(--fat-color)', unit: 'g' },
        ].map(({ key, label, color, unit }) => (
          <div key={key} style={{ textAlign: 'center' }}>
            <label className="form-label" style={{ textAlign: 'center', color }}>{label}</label>
            <input
              type="number"
              value={goals[key]}
              onChange={e => handleCustomGramChange(key, e.target.value)}
              disabled={activePreset !== 'custom'}
              min="0"
              style={{
                textAlign: 'center', fontWeight: 600,
                opacity: activePreset !== 'custom' ? 0.7 : 1,
              }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4 }}>
              {currentPct[key]}% of calories
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
