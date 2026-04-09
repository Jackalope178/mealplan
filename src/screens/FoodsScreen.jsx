import React, { useState, useEffect, useCallback } from 'react';
import { fetchFoods, insertFood, patchFood, removeFood } from '../utils/db';
import { estimateFoodMacros } from '../utils/api';

function MacroPills({ macros }) {
  if (!macros) return null;
  return (
    <div className="macro-pills">
      <span className="macro-pill calories">{macros.calories} cal</span>
      <span className="macro-pill protein">P {macros.protein}g</span>
      <span className="macro-pill carbs">C {macros.carbs}g</span>
      <span className="macro-pill fat">F {macros.fat}g</span>
    </div>
  );
}

function FoodEditor({ food, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: food?.name || '',
    brand: food?.brand || '',
    servingSize: food?.servingSize || '1 serving',
    macros: food?.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
    macroSource: food?.macroSource || 'manual',
    manualMacros: !food || food?.macroSource === 'manual',
  });
  const [estimating, setEstimating] = useState(false);

  const updateField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleEstimate = async () => {
    if (!form.name.trim()) { alert('Enter a food name first.'); return; }
    setEstimating(true);
    try {
      const macros = await estimateFoodMacros(form.name, form.brand, form.servingSize);
      setForm(prev => ({ ...prev, macros, macroSource: 'calculated', manualMacros: false }));
    } catch (err) {
      alert('Could not estimate: ' + err.message);
    }
    setEstimating(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) { alert('Enter a food name.'); return; }
    onSave({
      name: form.name,
      brand: form.brand,
      servingSize: form.servingSize,
      macros: form.macros,
      macroSource: form.manualMacros ? 'manual' : form.macroSource,
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{food ? 'Edit Food' : 'Add Food'}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>

        <div className="form-group">
          <label className="form-label">Food Name</label>
          <input value={form.name} onChange={e => updateField('name', e.target.value)}
            placeholder="e.g. Greek Yogurt, Chicken Breast" />
        </div>

        <div className="form-group">
          <label className="form-label">Brand (optional)</label>
          <input value={form.brand} onChange={e => updateField('brand', e.target.value)}
            placeholder="e.g. Fage, Mission, Fairlife" />
        </div>

        <div className="form-group">
          <label className="form-label">Serving Size</label>
          <input value={form.servingSize} onChange={e => updateField('servingSize', e.target.value)}
            placeholder="e.g. 1 cup, 1 tortilla, 4 oz" />
        </div>

        <div className="form-group">
          <label className="form-label">Macros (per serving)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className={`btn btn-sm ${form.manualMacros ? 'btn-secondary' : 'btn-primary'}`}
              onClick={handleEstimate} disabled={estimating}>
              {estimating ? 'Estimating...' : 'Estimate for Me'}
            </button>
            <button className={`btn btn-sm ${form.manualMacros ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setForm(prev => ({ ...prev, manualMacros: true }))}>
              Enter Myself
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { key: 'calories', label: 'Calories' },
              { key: 'protein', label: 'Protein (g)' },
              { key: 'carbs', label: 'Carbs (g)' },
              { key: 'fat', label: 'Fat (g)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="form-label" style={{ fontSize: 14 }}>{label}</label>
                <input type="number" min="0" value={form.macros[key]}
                  disabled={!form.manualMacros}
                  style={{ opacity: form.manualMacros ? 1 : 0.7 }}
                  onChange={e => setForm(prev => ({
                    ...prev, macros: { ...prev.macros, [key]: parseInt(e.target.value) || 0 },
                  }))} />
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleSave} style={{ fontSize: 18 }}>
          Save Food
        </button>
      </div>
    </div>
  );
}

export default function FoodsScreen({ userId }) {
  const [foods, setFoods] = useState([]);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadFoods = useCallback(async () => {
    try { setFoods(await fetchFoods()); }
    catch (err) { console.error('Failed to load foods:', err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadFoods(); }, [loadFoods]);

  const handleSave = async (foodData) => {
    try {
      if (editing && editing !== 'new' && editing.id) {
        await patchFood(editing.id, foodData);
      } else {
        await insertFood(foodData, userId);
      }
      await loadFoods();
    } catch (err) {
      alert('Could not save: ' + err.message);
    }
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this food?')) {
      try { await removeFood(id); await loadFoods(); }
      catch (err) { alert('Could not delete: ' + err.message); }
    }
  };

  const filtered = search
    ? foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.brand.toLowerCase().includes(search.toLowerCase()))
    : foods;

  if (loading) {
    return (
      <div className="screen-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading foods...</p>
      </div>
    );
  }

  return (
    <div className="screen-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>My Foods</h1>
      </div>

      {foods.length > 0 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search foods..." style={{ marginBottom: 16 }} />
      )}

      <button className="btn btn-primary btn-full" onClick={() => setEditing('new')}
        style={{ marginBottom: 20, fontSize: 18 }}>
        + Add Food
      </button>

      {filtered.map(food => (
        <div key={food.id} className="card" style={{ cursor: 'pointer' }}
          onClick={() => setEditing(food)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: 2 }}>{food.name}</h3>
              {food.brand && (
                <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 4 }}>{food.brand}</p>
              )}
              <p style={{ fontSize: 13, color: 'var(--warm-gray-light)', marginBottom: 8 }}>
                {food.servingSize}
              </p>
              <MacroPills macros={food.macros} />
            </div>
            <button onClick={e => { e.stopPropagation(); handleDelete(food.id); }}
              style={{
                background: 'none', border: 'none', color: 'var(--warm-gray-light)',
                fontSize: 20, cursor: 'pointer', padding: 4,
              }}>&times;</button>
          </div>
        </div>
      ))}

      {foods.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8h1a4 4 0 010 8h-1" />
            <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
          </svg>
          <p>No foods saved yet. Add your common foods to quickly track macros!</p>
        </div>
      )}

      {editing !== null && (
        <FoodEditor food={editing === 'new' ? null : editing}
          onSave={handleSave} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}
