// localStorage helpers for Nourish data model

const KEYS = {
  goals: 'nourish_goals',
  recipes: 'nourish_recipes',
  plan: 'nourish_plan',
  log: 'nourish_log',
  onboarded: 'nourish_onboarded',
};

function get(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Goals
export function getGoals() {
  return get(KEYS.goals) || { calories: 2000, protein: 120, carbs: 200, fat: 65 };
}
export function saveGoals(goals) {
  set(KEYS.goals, goals);
}

// Onboarding
export function isOnboarded() {
  return !!get(KEYS.onboarded);
}
export function setOnboarded() {
  set(KEYS.onboarded, true);
}

// Recipes
export function getRecipes() {
  return get(KEYS.recipes) || [];
}
export function saveRecipes(recipes) {
  set(KEYS.recipes, recipes);
}
export function addRecipe(recipe) {
  const recipes = getRecipes();
  recipes.push({ ...recipe, id: crypto.randomUUID(), lastEdited: Date.now() });
  saveRecipes(recipes);
  return recipes;
}
export function updateRecipe(id, updates) {
  const recipes = getRecipes();
  const idx = recipes.findIndex(r => r.id === id);
  if (idx !== -1) {
    recipes[idx] = { ...recipes[idx], ...updates, lastEdited: Date.now() };
    saveRecipes(recipes);
  }
  return recipes;
}
export function deleteRecipe(id) {
  const recipes = getRecipes().filter(r => r.id !== id);
  saveRecipes(recipes);
  return recipes;
}

// Plan – keyed by ISO week string e.g. "2025-W03"
export function getWeekPlan(weekKey) {
  const plans = get(KEYS.plan) || {};
  return plans[weekKey] || createEmptyWeek();
}
export function saveWeekPlan(weekKey, week) {
  const plans = get(KEYS.plan) || {};
  plans[weekKey] = week;
  set(KEYS.plan, plans);
}

export function createEmptyWeek() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
  const week = {};
  days.forEach(d => {
    week[d] = {};
    slots.forEach(s => { week[d][s] = null; });
  });
  return week;
}

// Log
export function getLog() {
  return get(KEYS.log) || { days: {}, streak: 0 };
}
export function saveLog(log) {
  set(KEYS.log, log);
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekDates(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayNum = d.getDay() || 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayNum + 1);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    dates.push(dt);
  }
  return dates;
}

export function getDayName(date) {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(date.getDay() + 6) % 7];
}
