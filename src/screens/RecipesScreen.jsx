import React, { useState, useCallback } from 'react';
import { getRecipes, addRecipe, updateRecipe, deleteRecipe } from '../utils/storage';
import { extractRecipeFromPhoto, calculateMacros } from '../utils/api';

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
    calculated: { className: 'badge badge-calc', label: 'Calculated from ingredients' },
    manual: { className: 'badge badge-manual', label: 'My numbers' },
  };
  const info = map[source] || map.manual;
  return <span className={info.className}>{info.label}</span>;
}

function RecipeCard({ recipe, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const edited = new Date(recipe.lastEdited).toLocaleDateString();

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: 6 }}>{recipe.name}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <SourceBadge source={recipe.macroSource} />
            <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
              {recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        {recipe.photo && (
          <img
            src={recipe.photo}
            alt={recipe.name}
            style={{
              width: 60, height: 60, borderRadius: 'var(--radius-sm)',
              objectFit: 'cover', marginLeft: 12,
            }}
          />
        )}
      </div>
      <MacroPills macros={recipe.macros} />
      {recipe.notes && (
        <div style={{ marginTop: 10 }}>
          <p style={{
            fontSize: 14, color: 'var(--text-light)', fontStyle: 'italic',
            cursor: 'pointer',
          }} onClick={() => setExpanded(!expanded)}>
            {expanded ? recipe.notes : recipe.notes.slice(0, 80) + (recipe.notes.length > 80 ? '...' : '')}
          </p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--warm-gray-light)' }}>Edited {edited}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(recipe)}>
            Edit
          </button>
          <button className="btn btn-sm" style={{ background: '#FAE5E2', color: 'var(--red-soft)' }} onClick={() => onDelete(recipe.id)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipeEditor({ recipe, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: recipe?.name || '',
    servings: recipe?.servings || 4,
    ingredients: recipe?.ingredients || [{ quantity: '', unit: '', name: '' }],
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

  const addIngredient = () => {
    setForm(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { quantity: '', unit: '', name: '' }],
    }));
  };

  const removeIngredient = (idx) => {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };

  const recalcMacros = async () => {
    setCalcLoading(true);
    try {
      const macros = await calculateMacros(form.ingredients, form.servings);
      setForm(prev => ({ ...prev, macros, macroSource: 'calculated', manualMacros: false }));
    } catch (err) {
      alert('Could not calculate macros: ' + err.message);
    }
    setCalcLoading(false);
  };

  const handleServingsChange = (newServings) => {
    const oldServings = form.servings || 1;
    const ratio = oldServings / newServings;
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
      name: form.name,
      servings: form.servings,
      ingredients: form.ingredients.filter(i => i.name.trim()),
      instructions: form.instructions,
      macros: form.macros,
      macroSource: form.manualMacros ? 'manual' : form.macroSource,
      notes: form.notes,
      photo: form.photo,
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
          <input
            value={form.name}
            onChange={e => updateField('name', e.target.value)}
            placeholder="What's it called?"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Servings</label>
          <input
            type="number" min="1"
            value={form.servings}
            onChange={e => handleServingsChange(parseInt(e.target.value) || 1)}
            style={{ width: 100 }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Ingredients</label>
          {form.ingredients.map((ing, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                placeholder="Qty"
                value={ing.quantity}
                onChange={e => updateIngredient(idx, 'quantity', e.target.value)}
                style={{ width: 70 }}
              />
              <input
                placeholder="Unit"
                value={ing.unit}
                onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                style={{ width: 80 }}
              />
              <input
                placeholder="Ingredient"
                value={ing.name}
                onChange={e => updateIngredient(idx, 'name', e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="modal-close"
                style={{ width: 32, height: 32, fontSize: 16, flexShrink: 0 }}
                onClick={() => removeIngredient(idx)}
              >&times;</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addIngredient}>
            + Add Ingredient
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Instructions</label>
          <textarea
            value={form.instructions}
            onChange={e => updateField('instructions', e.target.value)}
            placeholder="How do you make it?"
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Macro toggle */}
        <div className="form-group">
          <label className="form-label">Macros (per serving)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              className={`btn btn-sm ${form.manualMacros ? 'btn-secondary' : 'btn-primary'}`}
              onClick={recalcMacros}
              disabled={calcLoading}
            >
              {calcLoading ? 'Calculating...' : 'Recalculate from ingredients'}
            </button>
            <button
              className={`btn btn-sm ${form.manualMacros ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setForm(prev => ({ ...prev, manualMacros: true }))}
            >
              I'll enter these myself
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label" style={{ fontSize: 14 }}>Calories</label>
              <input
                type="number" min="0"
                value={form.macros.calories}
                disabled={!form.manualMacros}
                onChange={e => setForm(prev => ({
                  ...prev, macros: { ...prev.macros, calories: parseInt(e.target.value) || 0 },
                }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 14 }}>Protein (g)</label>
              <input
                type="number" min="0"
                value={form.macros.protein}
                disabled={!form.manualMacros}
                onChange={e => setForm(prev => ({
                  ...prev, macros: { ...prev.macros, protein: parseInt(e.target.value) || 0 },
                }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 14 }}>Carbs (g)</label>
              <input
                type="number" min="0"
                value={form.macros.carbs}
                disabled={!form.manualMacros}
                onChange={e => setForm(prev => ({
                  ...prev, macros: { ...prev.macros, carbs: parseInt(e.target.value) || 0 },
                }))}
              />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: 14 }}>Fat (g)</label>
              <input
                type="number" min="0"
                value={form.macros.fat}
                disabled={!form.manualMacros}
                onChange={e => setForm(prev => ({
                  ...prev, macros: { ...prev.macros, fat: parseInt(e.target.value) || 0 },
                }))}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Personal Notes</label>
          <textarea
            value={form.notes}
            onChange={e => updateField('notes', e.target.value)}
            placeholder="Any personal notes? Substitutions, tips..."
            rows={3}
            style={{ resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary btn-full" onClick={handleSave}>
            Save Recipe
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecipesScreen() {
  const [recipes, setRecipes] = useState(getRecipes());
  const [editing, setEditing] = useState(null); // null | 'new' | recipe object
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');

  const refreshRecipes = () => setRecipes(getRecipes());

  const handlePhotoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Convert to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const photoUrl = URL.createObjectURL(file);
      const mimeType = file.type || 'image/jpeg';

      // Extract recipe via Claude
      const extracted = await extractRecipeFromPhoto(base64, mimeType);

      // If Claude didn't find macros on card, calculate via Edamam
      let macros = extracted.macros;
      let macroSource = extracted.macroSource || 'calculated';

      if (!macros && extracted.ingredients?.length) {
        try {
          macros = await calculateMacros(extracted.ingredients, extracted.servings || 1);
          macroSource = 'calculated';
        } catch {
          macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          macroSource = 'manual';
        }
      }

      const newRecipe = {
        ...extracted,
        macros: macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
        macroSource,
        photo: photoUrl,
        notes: '',
      };

      const updated = addRecipe(newRecipe);
      setRecipes(updated);
    } catch (err) {
      alert('Could not read recipe: ' + err.message);
    }
    setUploading(false);
    e.target.value = '';
  }, []);

  const handleSaveEdit = (recipeData) => {
    if (editing && editing !== 'new' && editing.id) {
      updateRecipe(editing.id, recipeData);
    } else {
      addRecipe(recipeData);
    }
    refreshRecipes();
    setEditing(null);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this recipe?')) {
      deleteRecipe(id);
      refreshRecipes();
    }
  };

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="screen-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>My Recipes</h1>
      </div>

      {/* Search */}
      {recipes.length > 0 && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Add buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <label className="btn btn-primary btn-full" style={{ cursor: 'pointer', position: 'relative' }}>
          {uploading ? 'Reading recipe...' : 'Upload Recipe Photo'}
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }}
            disabled={uploading}
          />
        </label>
        <button className="btn btn-outline btn-full" onClick={() => setEditing('new')}>
          Add Manually
        </button>
      </div>

      {uploading && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--sage-dark)' }}>
          <p>Analyzing your recipe photo...</p>
          <div className="progress-bar-track" style={{ marginTop: 12 }}>
            <div className="progress-bar-fill" style={{
              width: '60%', background: 'var(--sage)',
              animation: 'pulse 1.5s infinite',
            }} />
          </div>
        </div>
      )}

      {/* Recipe list */}
      {filtered.map(recipe => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      ))}

      {recipes.length === 0 && !uploading && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          <p>No recipes yet. Upload a photo or add one manually to get started!</p>
        </div>
      )}

      {/* Editor modal */}
      {editing !== null && (
        <RecipeEditor
          recipe={editing === 'new' ? null : editing}
          onSave={handleSaveEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
