// Supabase data layer for Nourish
// All reads/writes go through here. Falls back to localStorage if Supabase is unavailable.

import { supabase } from './supabaseClient';

// ─── Recipes (shared library) ───────────────────────────────────────

export async function fetchRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, favorites(user_id)')
    .order('last_edited', { ascending: false });
  if (error) throw error;
  return data.map(r => ({
    id: r.id,
    createdBy: r.created_by,
    name: r.name,
    servings: r.servings,
    ingredients: r.ingredients || [],
    instructions: r.instructions || '',
    macros: r.macros,
    macroSource: r.macro_source,
    notes: r.notes || '',
    photo: r.photo_url,
    lastEdited: r.last_edited,
    favoritedBy: (r.favorites || []).map(f => f.user_id),
  }));
}

export async function insertRecipe(recipe, userId) {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      created_by: userId,
      name: recipe.name,
      servings: recipe.servings || 1,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || '',
      macros: recipe.macros || null,
      macro_source: recipe.macroSource || 'manual',
      notes: recipe.notes || '',
      photo_url: recipe.photo || null,
      last_edited: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function patchRecipe(id, updates) {
  const payload = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.servings !== undefined) payload.servings = updates.servings;
  if (updates.ingredients !== undefined) payload.ingredients = updates.ingredients;
  if (updates.instructions !== undefined) payload.instructions = updates.instructions;
  if (updates.macros !== undefined) payload.macros = updates.macros;
  if (updates.macroSource !== undefined) payload.macro_source = updates.macroSource;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.photo !== undefined) payload.photo_url = updates.photo;
  payload.last_edited = new Date().toISOString();

  const { error } = await supabase.from('recipes').update(payload).eq('id', id);
  if (error) throw error;
}

export async function removeRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

// ─── Favorites ──────────────────────────────────────────────────────

export async function addFavorite(userId, recipeId) {
  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: userId, recipe_id: recipeId });
  if (error && error.code !== '23505') throw error; // ignore duplicate
}

export async function removeFavorite(userId, recipeId) {
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('recipe_id', recipeId);
  if (error) throw error;
}

// ─── Goals (per user) ───────────────────────────────────────────────

export async function fetchGoals(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select()
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { calories: 2000, protein: 120, carbs: 200, fat: 65 };
  return {
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
  };
}

export async function upsertGoals(userId, goals) {
  const { error } = await supabase
    .from('goals')
    .upsert({
      user_id: userId,
      calories: goals.calories,
      protein: goals.protein,
      carbs: goals.carbs,
      fat: goals.fat,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ─── Meal Plans (per user, by week) ─────────────────────────────────

export async function fetchWeekPlan(userId, weekKey) {
  const { data, error } = await supabase
    .from('meal_plans')
    .select()
    .eq('user_id', userId)
    .eq('week_key', weekKey)
    .maybeSingle();
  if (error) throw error;
  return data?.plan || null;
}

export async function upsertWeekPlan(userId, weekKey, plan) {
  const { error } = await supabase
    .from('meal_plans')
    .upsert({
      user_id: userId,
      week_key: weekKey,
      plan,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,week_key' });
  if (error) throw error;
}

// ─── Daily Logs (per user) ──────────────────────────────────────────

export async function fetchDailyLog(userId, dateKey) {
  const { data, error } = await supabase
    .from('daily_logs')
    .select()
    .eq('user_id', userId)
    .eq('date_key', dateKey)
    .maybeSingle();
  if (error) throw error;
  return data?.meals_checked || {};
}

export async function upsertDailyLog(userId, dateKey, mealsChecked) {
  const { error } = await supabase
    .from('daily_logs')
    .upsert({
      user_id: userId,
      date_key: dateKey,
      meals_checked: mealsChecked,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date_key' });
  if (error) throw error;
}

export async function fetchRecentLogs(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startKey = startDate.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_logs')
    .select()
    .eq('user_id', userId)
    .gte('date_key', startKey)
    .order('date_key', { ascending: false });
  if (error) throw error;

  const logs = {};
  (data || []).forEach(row => {
    logs[row.date_key] = row.meals_checked;
  });
  return logs;
}
