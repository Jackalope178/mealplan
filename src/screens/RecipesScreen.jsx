import React, { useState, useEffect, useCallback } from 'react';
import { fetchRecipes, insertRecipe, patchRecipe, removeRecipe, addFavorite, removeFavorite } from '../utils/db';
import { extractRecipeFromPhoto, calculateMacros } from '../utils/api';

// Compress an image file to a smaller data URL for thumbnail storage
function compressImage(file, maxSize = 400) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h) { h = (maxSize / w) * h; w = maxSize; }
      else { w = (maxSize / h) * w; h = maxSize; }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
}

// Read file to base64 (raw, no data URL prefix)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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

function RecipeCard({ recipe, userId, onEdit, onDelete, onToggleFavorite }) {
  const [expanded, setExpanded] = useState(false);
  const edited = new Date(recipe.lastEdited).toLocaleDateString();
  const isMine = recipe.createdBy === userId;
  const isFav = (recipe.favoritedBy || []).includes(userId);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ marginBottom: 0 }}>{recipe.name}</h3>
            <HeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(recipe.id, isFav)} />
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
      {recipe.notes && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 14, color: 'var(--text-light)', fontStyle: 'italic', cursor: 'pointer' }}
            onClick={() => setExpanded(!expanded)}>
            {expanded ? recipe.notes : recipe.notes.slice(0, 80) + (recipe.notes.length > 80 ? '...' : '')}
          </p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--warm-gray-light)' }}>Edited {edited}</span>
        {isMine && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit(recipe)}>Edit</button>
            <button className="btn btn-sm" style={{ background: '#FAE5E2', color: 'var(--red-soft)' }}
              onClick={() => onDelete(recipe.id)}>Delete</button>
          </div>
        )}
      </div>
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
      notes: form.notes, photo: form.photo,
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
                <input type="number" min="0" value={form.macros[key]} disabled={!form.manualMacros}
                  onChange={e => setForm(prev => ({ ...prev, macros: { ...prev.macros, [key]: parseInt(e.target.value) || 0 } }))} />
              </div>
            ))}
          </div>
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

// Multi-photo upload modal
function PhotoUploader({ onDone, onCancel, userId }) {
  const [photos, setPhotos] = useState([]); // [{ file, preview, base64, mimeType }]
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [results, setResults] = useState([]); // [{ success, name, error? }]

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const newPhotos = await Promise.all(files.map(async (file) => ({
      file,
      preview: URL.createObjectURL(file),
      base64: await fileToBase64(file),
      mimeType: file.type || 'image/jpeg',
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
    setResults([]);
    setProgress({ current: 0, total: photos.length, name: '' });

    const allResults = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      setProgress({ current: i + 1, total: photos.length, name: `Photo ${i + 1} of ${photos.length}` });

      try {
        const extracted = await extractRecipeFromPhoto(photo.base64, photo.mimeType);

        // Compress the photo for the recipe card thumbnail
        const thumbnail = await compressImage(photo.file, 400);

        await insertRecipe({
          ...extracted,
          macros: extracted.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
          macroSource: extracted.macroSource === 'card' ? 'card' : 'calculated',
          photo: thumbnail,
          notes: '',
        }, userId);

        allResults.push({ success: true, name: extracted.name || `Recipe ${i + 1}` });
      } catch (err) {
        allResults.push({ success: false, name: `Photo ${i + 1}`, error: err.message });
      }
    }

    setResults(allResults);
    setProcessing(false);
  };

  const allDone = results.length > 0;
  const successCount = results.filter(r => r.success).length;

  return (
    <div className="modal-overlay" onClick={!processing ? onCancel : undefined}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{allDone ? 'All Done!' : 'Upload Recipe Photos'}</h2>
          {!processing && <button className="modal-close" onClick={onCancel}>&times;</button>}
        </div>

        {/* Results screen */}
        {allDone && (
          <div>
            <p style={{ fontSize: 16, color: 'var(--sage-dark)', fontWeight: 600, marginBottom: 16 }}>
              {successCount} recipe{successCount !== 1 ? 's' : ''} added!
            </p>
            {results.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: r.success ? '#E8F0E8' : '#FAE5E2',
                borderRadius: 'var(--radius-sm)', marginBottom: 6,
              }}>
                <span style={{ fontSize: 18 }}>{r.success ? '\u2713' : '\u2717'}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{r.name}</span>
                {r.error && <span style={{ fontSize: 13, color: 'var(--red-soft)' }}>— {r.error}</span>}
              </div>
            ))}
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
              onClick={() => { onDone(); }}>
              Done
            </button>
          </div>
        )}

        {/* Processing screen */}
        {processing && !allDone && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--sage-dark)', marginBottom: 8 }}>
              Reading {progress.name}...
            </p>
            <div className="progress-bar-track" style={{ marginBottom: 8 }}>
              <div className="progress-bar-fill" style={{
                width: `${(progress.current / progress.total) * 100}%`,
                background: 'var(--sage)',
              }} />
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-light)' }}>
              This may take a moment per photo.
            </p>
          </div>
        )}

        {/* Selection screen */}
        {!processing && !allDone && (
          <>
            <p style={{ fontSize: 15, color: 'var(--text-light)', marginBottom: 16 }}>
              Add photos of recipe cards, cookbook pages, or HelloFresh cards. Then tap Submit to read them all.
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
                Submit {photos.length} Photo{photos.length !== 1 ? 's' : ''}
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
  const [showUploader, setShowUploader] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
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

  let filtered = recipes;
  if (filter === 'favorites') filtered = filtered.filter(r => (r.favoritedBy || []).includes(userId));
  if (filter === 'mine') filtered = filtered.filter(r => r.createdBy === userId);
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[{ key: 'all', label: 'All' }, { key: 'favorites', label: 'Favorites' }, { key: 'mine', label: 'Mine' }].map(f => (
          <button key={f.key} className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

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
          onEdit={setEditing} onDelete={handleDelete} onToggleFavorite={handleToggleFavorite} />
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
