import React, { useState, useEffect, useCallback } from 'react';
import { fetchRecipes, insertRecipe, patchRecipe, removeRecipe, addFavorite, removeFavorite } from '../utils/db';
import { extractRecipeFromPhotos, calculateMacros } from '../utils/api';

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

function RecipeDetail({ recipe, userId, onClose, onEdit, onDelete, onToggleFavorite }) {
  const isMine = recipe.createdBy === userId;
  const isFav = (recipe.favoritedBy || []).includes(userId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ flex: 1, paddingRight: 8 }}>{recipe.name}</h2>
          <HeartButton isFavorite={isFav} onToggle={() => onToggleFavorite(recipe.id, isFav)} />
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Photo */}
        {recipe.photo && (
          <img src={recipe.photo} alt={recipe.name} style={{
            width: '100%', maxHeight: 240, objectFit: 'cover',
            borderRadius: 'var(--radius-sm)', marginBottom: 16,
          }} />
        )}

        {/* Macros + badge */}
        <div style={{ marginBottom: 16 }}>
          <MacroPills macros={recipe.macros} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <SourceBadge source={recipe.macroSource} />
            <span style={{ fontSize: 14, color: 'var(--text-light)' }}>
              {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Ingredients */}
        {recipe.ingredients?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 10, color: 'var(--sage-dark)' }}>Ingredients</h3>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'baseline', gap: 8,
                padding: '8px 0',
                borderBottom: i < recipe.ingredients.length - 1 ? '1px solid var(--cream-dark)' : 'none',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: 'var(--sage-light)',
                  flexShrink: 0, marginTop: 6,
                }} />
                <span style={{ fontSize: 16 }}>
                  {ing.quantity && <strong>{ing.quantity} {ing.unit}</strong>}
                  {ing.quantity ? ' ' : ''}{ing.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 10, color: 'var(--sage-dark)' }}>How to Make It</h3>
            <div style={{
              fontSize: 16, lineHeight: 1.7, color: 'var(--text)',
              whiteSpace: 'pre-wrap',
            }}>
              {recipe.instructions}
            </div>
          </div>
        )}

        {/* Notes */}
        {recipe.notes && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 8, color: 'var(--terracotta)' }}>My Notes</h3>
            <p style={{
              fontSize: 15, color: 'var(--text-light)', fontStyle: 'italic',
              background: 'var(--cream)', padding: '12px 14px',
              borderRadius: 'var(--radius-sm)', lineHeight: 1.5,
            }}>
              {recipe.notes}
            </p>
          </div>
        )}

        {/* Actions */}
        {isMine && (
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary btn-full" onClick={() => { onClose(); onEdit(recipe); }}>
              Edit Recipe
            </button>
            <button className="btn btn-full" style={{ background: '#FAE5E2', color: 'var(--red-soft)' }}
              onClick={() => { onClose(); onDelete(recipe.id); }}>
              Delete
            </button>
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
      {recipe.notes && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 14, color: 'var(--text-light)', fontStyle: 'italic' }}>
            {recipe.notes.slice(0, 60)}{recipe.notes.length > 60 ? '...' : ''}
          </p>
        </div>
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
          onToggleFavorite={handleToggleFavorite} />
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
