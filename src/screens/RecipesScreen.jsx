import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchRecipes, insertRecipe, patchRecipe, removeRecipe, addFavorite, removeFavorite } from '../utils/db';
import { extractRecipeFromPhotos, calculateMacros, estimateIngredientMacros } from '../utils/api';

const PRESET_TAGS = [
  'Chicken', 'Beef', 'Pork', 'Fish', 'Shrimp', 'Turkey', 'Lamb',
  'Tofu', 'Vegetarian', 'Vegan', 'Pasta', 'Soup', 'Salad',
  'Breakfast', 'Slow Cooker', 'Quick',
];

// Resize an image file via canvas. Returns a data URL (image/jpeg).
function resizeImage(file, maxSize, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = (maxSize / w) * h; w = maxSize; }
        else { w = (maxSize / h) * w; h = maxSize; }
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = URL.createObjectURL(file);
  });
}

// Compress for thumbnail storage (small)
function compressImage(file) {
  return resizeImage(file, 400, 0.7);
}

// Compress for Claude API (under 5MB base64 ≈ ~3.7MB file ≈ 1600px max)
async function compressForApi(file) {
  const dataUrl = await resizeImage(file, 1600, 0.75);
  // Return raw base64 without the data:image/jpeg;base64, prefix
  return dataUrl.split(',')[1];
}

function TagChips({ tags, small }) {
  if (!tags?.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {tags.map(tag => (
        <span key={tag} style={{
          padding: small ? '2px 8px' : '4px 10px',
          borderRadius: 12, fontSize: small ? 11 : 13,
          fontWeight: 600, fontFamily: 'var(--font-display)',
          background: 'var(--cream-dark)', color: 'var(--text-light)',
        }}>{tag}</span>
      ))}
    </div>
  );
}

function TagEditor({ tags, onChange }) {
  const toggleTag = (tag) => {
    if (tags.includes(tag)) onChange(tags.filter(t => t !== tag));
    else onChange([...tags, tag]);
  };

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {PRESET_TAGS.map(tag => (
        <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
          padding: '6px 12px', borderRadius: 16, fontSize: 14,
          fontWeight: 600, fontFamily: 'var(--font-display)',
          background: tags.includes(tag) ? 'var(--sage)' : 'var(--cream-dark)',
          color: tags.includes(tag) ? 'white' : 'var(--text-light)',
          border: 'none', cursor: 'pointer', transition: 'all 0.15s',
        }}>{tag}</button>
      ))}
    </div>
  );
}

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

function SourceBadge({ source }) {
  const map = {
    card: { className: 'badge badge-card', label: 'Macros from card' },
    calculated: { className: 'badge badge-calc', label: 'Estimated from ingredients' },
    estimated: { className: 'badge badge-calc', label: 'Estimated from ingredients' },
    manual: { className: 'badge badge-manual', label: 'My numbers' },
  };
  const info = map[source] || map.manual;
  return <span className={info.className}>{info.label}</span>;
}

function HeartButton({ isFavorite, onToggle }) {
  return (
    <button onClick={onToggle}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 22, padding: 4, lineHeight: 1,
        color: isFavorite ? 'var(--terracotta)' : 'var(--cream-dark)',
        transition: 'color 0.2s, transform 0.2s',
      }}>
      {isFavorite ? '\u2665' : '\u2661'}
    </button>
  );
}

function PencilIcon({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
      color: 'var(--sage)', display: 'flex', alignItems: 'center',
    }} title="Edit">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
        <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}

function IngredientMacroEditor({ ingredient, onUpdate, onEstimate, estimating }) {
  const [showMacros, setShowMacros] = useState(!!ingredient.macros);
  const macros = ingredient.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 };

  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid var(--cream-dark)',
    }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
        <input placeholder="Qty" value={ingredient.quantity}
          onChange={e => onUpdate({ ...ingredient, quantity: e.target.value })}
          style={{ width: 60, padding: '8px 10px' }} />
        <input placeholder="Unit" value={ingredient.unit}
          onChange={e => onUpdate({ ...ingredient, unit: e.target.value })}
          style={{ width: 70, padding: '8px 10px' }} />
        <input placeholder="Ingredient" value={ingredient.name}
          onChange={e => onUpdate({ ...ingredient, name: e.target.value })}
          style={{ flex: 1, padding: '8px 10px' }} />
      </div>
      <button onClick={() => setShowMacros(!showMacros)} style={{
        background: 'none', border: 'none', fontSize: 13, color: 'var(--sage-dark)',
        fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-display)', padding: '2px 0',
      }}>
        {showMacros ? 'Hide macros' : '+ Add macros for this ingredient'}
      </button>
      {showMacros && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button className="btn btn-sm btn-secondary" style={{ fontSize: 13, padding: '6px 10px' }}
              onClick={() => onEstimate(ingredient)} disabled={estimating}>
              {estimating ? 'Estimating...' : 'Estimate'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            {['calories', 'protein', 'carbs', 'fat'].map(key => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>
                  {key === 'calories' ? 'Cal' : key.charAt(0).toUpperCase() + key.slice(1)}
                </label>
                <input type="number" min="0" value={macros[key] || ''} placeholder="0"
                  style={{ padding: '6px 8px', fontSize: 14 }}
                  onChange={e => onUpdate({
                    ...ingredient,
                    macros: { ...macros, [key]: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 },
                  })} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function parseSteps(instructions) {
  if (!instructions) return [];
  const text = String(instructions);
  const steps = [];

  text.split('\n').forEach(function(line) {
    // Try splitting on inline step numbers like " 2. " mid-line
    var segments = line.split(/\s+(\d+\.\s)/);
    var buffer = '';
    for (var i = 0; i < segments.length; i++) {
      var s = segments[i];
      if (/^\d+\.\s$/.test(s)) {
        if (buffer.trim()) steps.push(buffer.trim());
        buffer = '';
      } else {
        buffer += s;
      }
    }
    if (buffer.trim()) steps.push(buffer.trim());
  });

  // Strip leading step numbers like "1." or "Step 1:"
  return steps
    .map(function(s) { return s.replace(/^(step\s*)?\d+[.:\s]+/i, '').trim(); })
    .filter(function(s) { return s.length > 0; });
}

function RecipeDetail({ recipe, userId, onClose, onEdit, onDelete, onToggleFavorite, onSave }) {
  const isMine = recipe.createdBy === userId;
  const isFav = (recipe.favoritedBy || []).includes(userId);
  const [editingIngredients, setEditingIngredients] = useState(false);
  const [editingSteps, setEditingSteps] = useState(false);
  const [ingredients, setIngredients] = useState(recipe.ingredients || []);
  const [instructions, setInstructions] = useState(recipe.instructions || '');
  const [estimatingIdx, setEstimatingIdx] = useState(-1);
  const [saving, setSaving] = useState(false);

  const updateIngredient = (idx, updated) => {
    const arr = [...ingredients];
    arr[idx] = updated;
    setIngredients(arr);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { quantity: '', unit: '', name: '' }]);
  };

  const removeIngredient = (idx) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const handleEstimateIngredient = async (ing, idx) => {
    if (!ing.name.trim()) return;
    setEstimatingIdx(idx);
    try {
      const macros = await estimateIngredientMacros(ing.quantity, ing.unit, ing.name);
      const arr = [...ingredients];
      arr[idx] = { ...arr[idx], macros };
      setIngredients(arr);
    } catch (err) {
      alert('Could not estimate: ' + err.message);
    }
    setEstimatingIdx(-1);
  };

  const saveIngredients = async () => {
    setSaving(true);
    try {
      await onSave(recipe.id, { ingredients: ingredients.filter(i => i.name.trim()) });
      setEditingIngredients(false);
    } catch (err) { alert('Could not save: ' + err.message); }
    setSaving(false);
  };

  const saveSteps = async () => {
    setSaving(true);
    try {
      await onSave(recipe.id, { instructions });
      setEditingSteps(false);
    } catch (err) { alert('Could not save: ' + err.message); }
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ flex: 1, paddingRight: 8 }}>{recipe.name}</h2>
          <HeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(recipe.id, isFav)} />
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {recipe.photo && (
          <img src={recipe.photo} alt={recipe.name} style={{
            width: '100%', maxHeight: 240, objectFit: 'cover',
            borderRadius: 'var(--radius-sm)', marginBottom: 16,
          }} />
        )}

        <div style={{ marginBottom: 16 }}>
          <MacroPills macros={recipe.macros} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <SourceBadge source={recipe.macroSource} />
            <span style={{ fontSize: 14, color: 'var(--text-light)' }}>
              {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {recipe.tags?.length > 0 && (
          <div style={{ marginBottom: 16 }}><TagChips tags={recipe.tags} /></div>
        )}

        {/* Ingredients */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <h3 style={{ color: 'var(--sage-dark)', flex: 1 }}>Ingredients</h3>
            {isMine && !editingIngredients && (
              <PencilIcon onClick={() => setEditingIngredients(true)} />
            )}
          </div>

          {editingIngredients ? (
            <div>
              {ingredients.map((ing, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <IngredientMacroEditor
                    ingredient={ing}
                    onUpdate={(updated) => updateIngredient(i, updated)}
                    onEstimate={(ing2) => handleEstimateIngredient(ing2, i)}
                    estimating={estimatingIdx === i}
                  />
                  <button onClick={() => removeIngredient(i)} style={{
                    position: 'absolute', top: 10, right: 0,
                    background: 'none', border: 'none', color: 'var(--warm-gray-light)',
                    fontSize: 18, cursor: 'pointer',
                  }}>&times;</button>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" onClick={addIngredient}
                style={{ marginTop: 8, marginRight: 8 }}>+ Add</button>
              <button className="btn btn-primary btn-sm" onClick={saveIngredients}
                disabled={saving} style={{ marginTop: 8 }}>
                {saving ? 'Saving...' : 'Save Ingredients'}
              </button>
              <button className="btn btn-sm" onClick={() => { setIngredients(recipe.ingredients || []); setEditingIngredients(false); }}
                style={{ marginTop: 8, marginLeft: 8, color: 'var(--text-light)', background: 'none' }}>Cancel</button>
            </div>
          ) : (
            (recipe.ingredients || []).map((ing, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 0',
                borderBottom: i < recipe.ingredients.length - 1 ? '1px solid var(--cream-dark)' : 'none',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--sage-light)',
                  flexShrink: 0, marginTop: 6,
                }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 16 }}>
                    {ing.quantity && <strong>{ing.quantity} {ing.unit}</strong>}
                    {ing.quantity ? ' ' : ''}{ing.name}
                  </span>
                  {ing.macros && (
                    <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>
                      {ing.macros.calories} cal · P{ing.macros.protein}g · C{ing.macros.carbs}g · F{ing.macros.fat}g
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Instructions */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <h3 style={{ color: 'var(--sage-dark)', flex: 1 }}>How to Make It</h3>
            {isMine && !editingSteps && (
              <PencilIcon onClick={() => setEditingSteps(true)} />
            )}
          </div>

          {editingSteps ? (
            <div>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                rows={10} style={{ resize: 'vertical', fontSize: 16, lineHeight: 1.6, marginBottom: 8 }} />
              <button className="btn btn-primary btn-sm" onClick={saveSteps} disabled={saving}>
                {saving ? 'Saving...' : 'Save Steps'}
              </button>
              <button className="btn btn-sm" onClick={() => { setInstructions(recipe.instructions || ''); setEditingSteps(false); }}
                style={{ marginLeft: 8, color: 'var(--text-light)', background: 'none' }}>Cancel</button>
            </div>
          ) : (
            recipe.instructions && parseSteps(recipe.instructions).map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--sage)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 18, flexShrink: 0,
                }}>{i + 1}</div>
                <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text)', paddingTop: 6, flex: 1 }}>
                  {step}
                </p>
              </div>
            ))
          )}
        </div>

        {recipe.notes && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 8, color: 'var(--terracotta)' }}>My Notes</h3>
            <p style={{
              fontSize: 15, color: 'var(--text-light)', fontStyle: 'italic',
              background: 'var(--cream)', padding: '12px 14px',
              borderRadius: 'var(--radius-sm)', lineHeight: 1.5,
            }}>{recipe.notes}</p>
          </div>
        )}

        {isMine && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary btn-full" onClick={() => { onClose(); onEdit(recipe); }}>
              Edit Full Recipe
            </button>
            <button className="btn btn-full" style={{ background: '#FAE5E2', color: 'var(--red-soft)' }}
              onClick={() => { onClose(); onDelete(recipe.id); }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeCard({ recipe, userId, onEdit, onDelete, onToggleFavorite, onView }) {
  const isFav = (recipe.favoritedBy || []).includes(userId);

  return (
    <div className="card" onClick={() => onView(recipe)} style={{ cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ marginBottom: 0 }}>{recipe.name}</h3>
            <HeartButton isFavorite={isFav} onToggle={(e) => { onToggleFavorite(recipe.id, isFav); }} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, marginBottom: 8 }}>
            <SourceBadge source={recipe.macroSource} />
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
              {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {recipe.photo && (
          <img src={recipe.photo} alt={recipe.name}
            style={{ width: 60, height: 60, borderRadius: 'var(--radius-sm)', objectFit: 'cover', marginLeft: 12 }} />
        )}
      </div>
      <MacroPills macros={recipe.macros} />
      {recipe.tags?.length > 0 && (
        <div style={{ marginTop: 8 }}><TagChips tags={recipe.tags} small /></div>
      )}
    </div>
  );
}

function RecipeEditor({ recipe, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: recipe?.name || '',
    servings: recipe?.servings || 4,
    ingredients: recipe?.ingredients?.length ? recipe.ingredients : [{ quantity: '', unit: '', name: '' }],
    instructions: recipe?.instructions || '',
    macros: recipe?.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
    macroSource: recipe?.macroSource || 'manual',
    notes: recipe?.notes || '',
    tags: recipe?.tags || [],
    photo: recipe?.photo || null,
    manualMacros: recipe?.macroSource === 'manual',
  });
  const [calcLoading, setCalcLoading] = useState(false);

  const updateField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const updateIngredient = (idx, field, val) => {
    const ingredients = [...form.ingredients];
    ingredients[idx] = { ...ingredients[idx], [field]: val };
    setForm(prev => ({ ...prev, ingredients }));
  };
  const addIngredient = () => setForm(prev => ({ ...prev, ingredients: [...prev.ingredients, { quantity: '', unit: '', name: '' }] }));
  const removeIngredient = (idx) => setForm(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== idx) }));

  const recalcMacros = async () => {
    setCalcLoading(true);
    try {
      const macros = await calculateMacros(form.ingredients, form.servings);
      setForm(prev => ({ ...prev, macros, macroSource: 'calculated', manualMacros: false }));
    } catch (err) { alert('Could not calculate macros: ' + err.message); }
    setCalcLoading(false);
  };

  const handleServingsChange = (newServings) => {
    const ratio = (form.servings || 1) / newServings;
    if (form.macros && !form.manualMacros) {
      const macros = {
        calories: Math.round(form.macros.calories * ratio),
        protein: Math.round(form.macros.protein * ratio),
        carbs: Math.round(form.macros.carbs * ratio),
        fat: Math.round(form.macros.fat * ratio),
      };
      setForm(prev => ({ ...prev, servings: newServings, macros }));
    } else {
      updateField('servings', newServings);
    }
  };

  const handleSave = () => {
    onSave({
      name: form.name, servings: form.servings,
      ingredients: form.ingredients.filter(i => i.name.trim()),
      instructions: form.instructions, macros: form.macros,
      macroSource: form.manualMacros ? 'manual' : form.macroSource,
      notes: form.notes, tags: form.tags, photo: form.photo,
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{recipe ? 'Edit Recipe' : 'New Recipe'}</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        <div className="form-group">
          <label className="form-label">Recipe Name</label>
          <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="What's it called?" />
        </div>
        <div className="form-group">
          <label className="form-label">Servings</label>
          <input type="number" min="1" value={form.servings}
            onChange={e => handleServingsChange(parseInt(e.target.value) || 1)} style={{ width: 100 }} />
        </div>
        <div className="form-group">
          <label className="form-label">Ingredients</label>
          {form.ingredients.map((ing, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input placeholder="Qty" value={ing.quantity} onChange={e => updateIngredient(idx, 'quantity', e.target.value)} style={{ width: 70 }} />
              <input placeholder="Unit" value={ing.unit} onChange={e => updateIngredient(idx, 'unit', e.target.value)} style={{ width: 80 }} />
              <input placeholder="Ingredient" value={ing.name} onChange={e => updateIngredient(idx, 'name', e.target.value)} style={{ flex: 1 }} />
              <button className="modal-close" style={{ width: 32, height: 32, fontSize: 16, flexShrink: 0 }} onClick={() => removeIngredient(idx)}>&times;</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addIngredient}>+ Add Ingredient</button>
        </div>
        <div className="form-group">
          <label className="form-label">Instructions</label>
          <textarea value={form.instructions} onChange={e => updateField('instructions', e.target.value)}
            placeholder="How do you make it?" rows={4} style={{ resize: 'vertical' }} />
        </div>
        <div className="form-group">
          <label className="form-label">Macros (per serving)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className={`btn btn-sm ${form.manualMacros ? 'btn-secondary' : 'btn-primary'}`}
              onClick={recalcMacros} disabled={calcLoading}>
              {calcLoading ? 'Calculating...' : 'Recalculate from ingredients'}
            </button>
            <button className={`btn btn-sm ${form.manualMacros ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setForm(prev => ({ ...prev, manualMacros: true }))}>
              I'll enter these myself
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[{ key: 'calories', label: 'Calories' }, { key: 'protein', label: 'Protein (g)' },
              { key: 'carbs', label: 'Carbs (g)' }, { key: 'fat', label: 'Fat (g)' }].map(({ key, label }) => (
              <div key={key}>
                <label className="form-label" style={{ fontSize: 14 }}>{label}</label>
                <input type="number" min="0" value={form.macros[key] || ''} placeholder="0" disabled={!form.manualMacros}
                  onChange={e => setForm(prev => ({ ...prev, macros: { ...prev.macros, [key]: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 } }))} />
              </div>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tags</label>
          <TagEditor tags={form.tags} onChange={tags => updateField('tags', tags)} />
        </div>
        <div className="form-group">
          <label className="form-label">Personal Notes</label>
          <textarea value={form.notes} onChange={e => updateField('notes', e.target.value)}
            placeholder="Any personal notes? Substitutions, tips..." rows={3} style={{ resize: 'vertical' }} />
        </div>
        <button className="btn btn-primary btn-full" onClick={handleSave}>Save Recipe</button>
      </div>
    </div>
  );
}

// Multi-photo upload modal — all photos = one recipe
function PhotoUploader({ onDone, onCancel, userId }) {
  const [photos, setPhotos] = useState([]); // [{ file, preview, base64, mimeType }]
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // { success, name, error? }

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newPhotos = await Promise.all(files.map(async (file) => ({
      file,
      preview: URL.createObjectURL(file),
      base64: await compressForApi(file),
      mimeType: 'image/jpeg',
    })));

    setPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    setPhotos(prev => {
      const removed = prev[idx];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (photos.length === 0) return;
    setProcessing(true);
    setResult(null);

    try {
      // Send ALL photos to Claude in one call → one recipe
      const images = photos.map(p => ({ base64: p.base64, mimeType: p.mimeType }));
      const extracted = await extractRecipeFromPhotos(images);

      // Use first photo as recipe card thumbnail
      const thumbnail = await compressImage(photos[0].file);

      await insertRecipe({
        ...extracted,
        macros: extracted.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
        macroSource: extracted.macroSource === 'card' ? 'card' : 'calculated',
        tags: extracted.tags || [],
        photo: thumbnail,
        notes: '',
      }, userId);

      setResult({ success: true, name: extracted.name || 'New Recipe' });
    } catch (err) {
      setResult({ success: false, error: err.message });
    }

    setProcessing(false);
  };

  return (
    <div className="modal-overlay" onClick={!processing ? onCancel : undefined}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{result ? (result.success ? 'Recipe Added!' : 'Something Went Wrong') : 'Upload Recipe Photos'}</h2>
          {!processing && <button className="modal-close" onClick={onCancel}>&times;</button>}
        </div>

        {/* Result screen */}
        {result && (
          <div>
            {result.success ? (
              <div style={{
                padding: '16px', background: '#E8F0E8',
                borderRadius: 'var(--radius-sm)', marginBottom: 16, textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>&#10003;</div>
                <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--sage-dark)' }}>{result.name}</p>
                <p style={{ fontSize: 14, color: 'var(--text-light)', marginTop: 4 }}>added to your recipe library</p>
              </div>
            ) : (
              <div style={{
                padding: '12px 14px', background: '#FAE5E2',
                borderRadius: 'var(--radius-sm)', marginBottom: 16,
              }}>
                <p style={{ fontSize: 15, color: 'var(--red-soft)' }}>{result.error}</p>
              </div>
            )}
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
              onClick={() => { onDone(); }}>
              Done
            </button>
          </div>
        )}

        {/* Processing screen */}
        {processing && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--sage-dark)', marginBottom: 8 }}>
              Reading your recipe...
            </p>
            <div className="progress-bar-track" style={{ marginBottom: 8 }}>
              <div className="progress-bar-fill" style={{
                width: '70%', background: 'var(--sage)',
              }} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-light)' }}>
              Analyzing {photos.length} photo{photos.length !== 1 ? 's' : ''}. This may take a moment.
            </p>
          </div>
        )}

        {/* Selection screen */}
        {!processing && !result && (
          <>
            <p style={{ fontSize: 15, color: 'var(--text-light)', marginBottom: 16 }}>
              Add all photos for one recipe (front, back, multiple pages). They'll be read together as one recipe.
            </p>

            {/* Photo grid */}
            {photos.length > 0 && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16,
              }}>
                {photos.map((p, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <img src={p.preview} alt={`Photo ${idx + 1}`} style={{
                      width: '100%', aspectRatio: '1', objectFit: 'cover',
                      borderRadius: 'var(--radius-sm)',
                    }} />
                    <button onClick={() => removePhoto(idx)} style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 26, height: 26, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.5)', color: 'white',
                      border: 'none', fontSize: 14, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>&times;</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add more photos */}
            <label className="btn btn-secondary btn-full" style={{ cursor: 'pointer', position: 'relative', marginBottom: 12 }}>
              {photos.length === 0 ? 'Choose Photos' : '+ Add More Photos'}
              <input type="file" accept="image/*" multiple onChange={handleFiles}
                style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }} />
            </label>

            {/* Submit */}
            {photos.length > 0 && (
              <button className="btn btn-primary btn-full" onClick={handleSubmit} style={{ fontSize: 18 }}>
                Read Recipe from {photos.length} Photo{photos.length !== 1 ? 's' : ''}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function RecipesScreen({ userId }) {
  const [recipes, setRecipes] = useState([]);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [showUploader, setShowUploader] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'favorites' | 'mine'
  const [tagFilter, setTagFilter] = useState(null); // null or a tag string
  const [loading, setLoading] = useState(true);

  const loadRecipes = useCallback(async () => {
    try {
      const data = await fetchRecipes();
      setRecipes(data);
    } catch (err) {
      console.error('Failed to load recipes:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  const handleSaveEdit = async (recipeData) => {
    try {
      if (editing && editing !== 'new' && editing.id) {
        await patchRecipe(editing.id, recipeData);
      } else {
        await insertRecipe(recipeData, userId);
      }
      await loadRecipes();
    } catch (err) {
      alert('Could not save: ' + err.message);
    }
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this recipe?')) {
      try { await removeRecipe(id); await loadRecipes(); }
      catch (err) { alert('Could not delete: ' + err.message); }
    }
  };

  const handleToggleFavorite = async (recipeId, currentlyFav) => {
    try {
      if (currentlyFav) await removeFavorite(userId, recipeId);
      else await addFavorite(userId, recipeId);
      await loadRecipes();
    } catch (err) { console.error('Favorite toggle failed:', err); }
  };

  // Collect all tags in use
  const allTags = useMemo(() => {
    const tagSet = new Set();
    recipes.forEach(r => (r.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [recipes]);

  let filtered = recipes;
  if (filter === 'favorites') filtered = filtered.filter(r => (r.favoritedBy || []).includes(userId));
  if (filter === 'mine') filtered = filtered.filter(r => r.createdBy === userId);
  if (tagFilter) filtered = filtered.filter(r => (r.tags || []).includes(tagFilter));
  if (search) filtered = filtered.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="screen-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading recipes...</p>
      </div>
    );
  }

  return (
    <div className="screen-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Recipes</h1>
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[{ key: 'all', label: 'All' }, { key: 'favorites', label: 'Favorites' }, { key: 'mine', label: 'Mine' }].map(f => (
          <button key={f.key} className={`btn btn-sm ${filter === f.key && !tagFilter ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setFilter(f.key); setTagFilter(null); }}>{f.label}</button>
        ))}
      </div>

      {/* Tag filter row */}
      {allTags.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12,
          overflowX: 'auto', paddingBottom: 4,
        }}>
          {allTags.map(tag => (
            <button key={tag} onClick={() => setTagFilter(tagFilter === tag ? null : tag)} style={{
              padding: '4px 12px', borderRadius: 14, fontSize: 13,
              fontWeight: 600, fontFamily: 'var(--font-display)',
              background: tagFilter === tag ? 'var(--terracotta)' : 'var(--cream-dark)',
              color: tagFilter === tag ? 'white' : 'var(--text-light)',
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}>{tag}</button>
          ))}
        </div>
      )}

      {recipes.length > 0 && (
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..." style={{ marginBottom: 16 }} />
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn btn-primary btn-full" onClick={() => setShowUploader(true)}>
          Upload Recipe Photos
        </button>
        <button className="btn btn-outline btn-full" onClick={() => setEditing('new')}>
          Add Manually
        </button>
      </div>

      {filtered.map(recipe => (
        <RecipeCard key={recipe.id} recipe={recipe} userId={userId}
          onView={setViewing} onEdit={setEditing} onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite} />
      ))}

      {recipes.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          <p>No recipes yet. Upload photos or add one manually to get started!</p>
        </div>
      )}

      {viewing && (
        <RecipeDetail recipe={viewing} userId={userId}
          onClose={() => setViewing(null)}
          onEdit={(r) => { setViewing(null); setEditing(r); }}
          onDelete={(id) => { setViewing(null); handleDelete(id); }}
          onToggleFavorite={handleToggleFavorite}
          onSave={async (id, updates) => {
            await patchRecipe(id, updates);
            await loadRecipes();
            const updated = (await fetchRecipes()).find(r => r.id === id);
            if (updated) setViewing(updated);
          }} />
      )}

      {showUploader && (
        <PhotoUploader userId={userId}
          onDone={() => { setShowUploader(false); loadRecipes(); }}
          onCancel={() => setShowUploader(false)} />
      )}

      {editing !== null && (
        <RecipeEditor recipe={editing === 'new' ? null : editing} onSave={handleSaveEdit} onCancel={() => setEditing(null)} />
      )}
    </div>
  );
}
