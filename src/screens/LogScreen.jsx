import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchGoals, fetchRecipes, fetchFoods, fetchWeekPlan, fetchDailyLog,
  upsertDailyLog, fetchRecentLogs,
} from '../utils/db';
import { getWeekKey, getDayName, todayKey } from '../utils/storage';
import { getDailyQuote } from '../utils/quotes';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

function calculateStreak(recentLogs) {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayLog = recentLogs[key];
    if (!dayLog) { if (i > 0) break; else continue; }
    const checked = Object.values(dayLog).filter(Boolean).length;
    if (checked > 0) streak++;
    else break;
  }
  return streak;
}

function FoodPicker({ foods, onPick, onCancel }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) ||
        (f.brand || '').toLowerCase().includes(search.toLowerCase()))
    : foods;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log a Food</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search your foods..." style={{ marginBottom: 16 }} />
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 20 }}>
            {foods.length === 0 ? 'No foods saved yet. Add some in the Foods tab!' : 'No matches found.'}
          </p>
        )}
        {filtered.map(f => (
          <button key={f.id} onClick={() => onPick(f)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', padding: '14px 16px', background: 'var(--cream)',
            borderRadius: 'var(--radius-sm)', marginBottom: 8, textAlign: 'left',
            border: 'none', cursor: 'pointer',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {f.name}
                {f.brand && <span style={{ fontWeight: 400, color: 'var(--text-light)' }}> · {f.brand}</span>}
              </div>
              {f.macros && (
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>
                  {f.macros.calories} cal · P{f.macros.protein}g · C{f.macros.carbs}g · F{f.macros.fat}g
                </div>
              )}
            </div>
            <span style={{ color: 'var(--sage)', fontSize: 20 }}>+</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LogScreen({ userId }) {
  const [goals, setGoals] = useState({ calories: 2000, protein: 120, carbs: 200, fat: 65 });
  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [todayPlan, setTodayPlan] = useState({});
  const [todayLog, setTodayLog] = useState({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [justChecked, setJustChecked] = useState(null);
  const [showFoodPicker, setShowFoodPicker] = useState(false);

  const tk = todayKey();
  const today = getDayName(new Date());
  const weekKey = getWeekKey();
  const quote = getDailyQuote();

  // todayLog shape: { breakfast: true, lunch: false, ..., loggedFoods: [{ id, name, macros, servings }] }

  const loadData = useCallback(async () => {
    try {
      const [g, r, f, plan, log, recentLogs] = await Promise.all([
        fetchGoals(userId),
        fetchRecipes(),
        fetchFoods(),
        fetchWeekPlan(userId, weekKey),
        fetchDailyLog(userId, tk),
        fetchRecentLogs(userId, 30),
      ]);
      setGoals(g);
      setRecipes(r);
      setFoods(f);
      setTodayPlan(plan?.[today] || {});
      setTodayLog(log || {});
      setStreak(calculateStreak(recentLogs));
    } catch (err) {
      console.error('LogScreen load error:', err);
    }
    setLoading(false);
  }, [userId, weekKey, tk, today]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveLog = async (newLog) => {
    setTodayLog(newLog);
    try {
      await upsertDailyLog(userId, tk, newLog);
      const recentLogs = await fetchRecentLogs(userId, 30);
      setStreak(calculateStreak(recentLogs));
    } catch (err) {
      console.error('Save log error:', err);
    }
  };

  const toggleMeal = (slot) => {
    const newLog = { ...todayLog, [slot]: !todayLog[slot] };
    if (!todayLog[slot]) {
      setJustChecked(slot);
      setTimeout(() => setJustChecked(null), 600);
    }
    saveLog(newLog);
  };

  const addLoggedFood = (food) => {
    const loggedFoods = todayLog.loggedFoods || [];
    const entry = {
      id: food.id,
      name: food.name,
      brand: food.brand || '',
      macros: food.macros || { calories: 0, protein: 0, carbs: 0, fat: 0 },
      servings: 1,
      loggedAt: Date.now(),
    };
    const newLog = { ...todayLog, loggedFoods: [...loggedFoods, entry] };
    saveLog(newLog);
    setShowFoodPicker(false);
    setJustChecked('food-' + entry.loggedAt);
    setTimeout(() => setJustChecked(null), 600);
  };

  const removeLoggedFood = (idx) => {
    const loggedFoods = [...(todayLog.loggedFoods || [])];
    loggedFoods.splice(idx, 1);
    saveLog({ ...todayLog, loggedFoods });
  };

  const updateFoodServings = (idx, servings) => {
    const loggedFoods = [...(todayLog.loggedFoods || [])];
    loggedFoods[idx] = { ...loggedFoods[idx], servings: Math.max(0.5, servings) };
    saveLog({ ...todayLog, loggedFoods });
  };

  // Calculate consumed macros
  const consumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const plannedMeals = SLOTS.filter(s => todayPlan[s]);

  // From checked planned meals
  plannedMeals.forEach(slot => {
    if (!todayLog[slot]) return;
    const r = recipes.find(rx => rx.id === todayPlan[slot]);
    if (r?.macros) {
      consumed.calories += r.macros.calories;
      consumed.protein += r.macros.protein;
      consumed.carbs += r.macros.carbs;
      consumed.fat += r.macros.fat;
    }
  });

  // From logged foods
  const loggedFoods = todayLog.loggedFoods || [];
  loggedFoods.forEach(f => {
    if (f.macros) {
      const s = f.servings || 1;
      consumed.calories += Math.round(f.macros.calories * s);
      consumed.protein += Math.round(f.macros.protein * s);
      consumed.carbs += Math.round(f.macros.carbs * s);
      consumed.fat += Math.round(f.macros.fat * s);
    }
  });

  const checkedCount = plannedMeals.filter(s => todayLog[s]).length;
  const totalItems = plannedMeals.length + loggedFoods.length;
  const doneItems = checkedCount + loggedFoods.length;
  const progressPct = totalItems > 0 ? doneItems / totalItems : 0;

  if (loading) {
    return (
      <div className="screen-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="screen-content">
      <h1 style={{ marginBottom: 20 }}>Daily Log</h1>

      {/* Quote */}
      <div className="card fade-in" style={{
        background: 'linear-gradient(135deg, var(--terracotta-light) 0%, var(--terracotta) 100%)',
        color: 'white', textAlign: 'center',
      }}>
        <p style={{ fontSize: 16, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 8 }}>
          "{quote.text}"
        </p>
        <p style={{ fontSize: 13, opacity: 0.85 }}>— {quote.author}</p>
      </div>

      {/* Streak */}
      <div className="card fade-in" style={{ animationDelay: '0.05s', textAlign: 'center' }}>
        <div style={{
          fontSize: 48, fontFamily: 'var(--font-display)', fontWeight: 800,
          color: streak > 0 ? 'var(--terracotta)' : 'var(--warm-gray-light)',
        }}>{streak}</div>
        <div style={{ fontSize: 16, color: 'var(--text-light)', fontWeight: 600 }}>day streak</div>
        {streak >= 3 && (
          <div style={{ marginTop: 8, fontSize: 14, color: 'var(--sage-dark)', fontWeight: 600 }}>
            Amazing consistency! Keep going!
          </div>
        )}
      </div>

      {/* Day progress */}
      <div className="card fade-in" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3>Today's Progress</h3>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 700,
            color: progressPct === 1 && totalItems > 0 ? 'var(--sage)' : 'var(--text-light)',
          }}>{doneItems} / {totalItems}</span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{
            width: `${progressPct * 100}%`,
            background: progressPct === 1 && totalItems > 0 ? 'var(--green)' : 'var(--amber)',
          }} />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 8, marginTop: 16, textAlign: 'center',
        }}>
          {[
            { label: 'Cal', val: consumed.calories, goal: goals.calories, color: 'var(--cal-color)' },
            { label: 'Protein', val: consumed.protein, goal: goals.protein, color: 'var(--protein-color)' },
            { label: 'Carbs', val: consumed.carbs, goal: goals.carbs, color: 'var(--carb-color)' },
            { label: 'Fat', val: consumed.fat, goal: goals.fat, color: 'var(--fat-color)' },
          ].map(m => (
            <div key={m.label}>
              <div style={{ fontWeight: 700, color: m.color, fontSize: 18, fontFamily: 'var(--font-display)' }}>
                {m.val}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-light)' }}>/ {m.goal} {m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Planned meals */}
      {plannedMeals.length > 0 && (
        <div className="fade-in" style={{ animationDelay: '0.15s' }}>
          <h3 style={{ marginBottom: 12, color: 'var(--sage-dark)' }}>Planned Meals</h3>
          {plannedMeals.map(slot => {
            const recipe = recipes.find(r => r.id === todayPlan[slot]);
            if (!recipe) return null;
            const checked = todayLog[slot];
            return (
              <div key={slot} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                opacity: checked ? 0.7 : 1, transition: 'opacity 0.3s',
              }}>
                <button onClick={() => toggleMeal(slot)} style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: `3px solid ${checked ? 'var(--sage)' : 'var(--cream-dark)'}`,
                  background: checked ? 'var(--sage)' : 'var(--white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.3s', cursor: 'pointer',
                }}>
                  {checked && (
                    <span className={justChecked === slot ? 'check-bloom' : ''}
                      style={{ color: 'white', fontSize: 24, fontWeight: 700 }}>&#10003;</span>
                  )}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, color: 'var(--text-light)', fontWeight: 600,
                    textTransform: 'uppercase', fontFamily: 'var(--font-display)',
                  }}>{SLOT_LABELS[slot]}</div>
                  <div style={{
                    fontSize: 17, fontWeight: 600,
                    textDecoration: checked ? 'line-through' : 'none',
                  }}>{recipe.name}</div>
                  {recipe.macros && (
                    <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>
                      {recipe.macros.calories} cal · P{recipe.macros.protein}g · C{recipe.macros.carbs}g · F{recipe.macros.fat}g
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Logged foods */}
      <div className="fade-in" style={{ animationDelay: '0.2s', marginTop: plannedMeals.length > 0 ? 8 : 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ color: 'var(--sage-dark)' }}>Logged Foods</h3>
        </div>

        {loggedFoods.map((food, idx) => (
          <div key={food.loggedAt || idx} className="card" style={{
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div className={justChecked === 'food-' + food.loggedAt ? 'check-bloom' : ''} style={{
              width: 40, height: 40, borderRadius: '50%', background: 'var(--sage)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>&#10003;</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {food.name}
                {food.brand && <span style={{ fontWeight: 400, color: 'var(--text-light)' }}> · {food.brand}</span>}
              </div>
              {food.macros && (
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>
                  {Math.round(food.macros.calories * (food.servings || 1))} cal ·
                  P{Math.round(food.macros.protein * (food.servings || 1))}g ·
                  C{Math.round(food.macros.carbs * (food.servings || 1))}g ·
                  F{Math.round(food.macros.fat * (food.servings || 1))}g
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <label style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 600 }}>Servings:</label>
                <input type="number" min="0.5" step="0.5" value={food.servings || 1}
                  onChange={e => updateFoodServings(idx, parseFloat(e.target.value) || 1)}
                  style={{ width: 65, padding: '4px 8px', fontSize: 14, textAlign: 'center' }} />
              </div>
            </div>
            <button onClick={() => removeLoggedFood(idx)} style={{
              background: 'none', border: 'none', color: 'var(--warm-gray-light)',
              fontSize: 20, cursor: 'pointer', padding: 4,
            }}>&times;</button>
          </div>
        ))}

        <button className="btn btn-outline btn-full" onClick={() => setShowFoodPicker(true)}
          style={{ marginTop: 4, fontSize: 16 }}>
          + Log a Food
        </button>
      </div>

      {/* No plan message */}
      {plannedMeals.length === 0 && loggedFoods.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-light)', marginTop: 12 }}>
          <p>No meals planned and no foods logged yet. Plan your meals or log a food above!</p>
        </div>
      )}

      {/* Completion */}
      {progressPct === 1 && totalItems > 0 && (
        <div className="card fade-in" style={{
          textAlign: 'center', background: 'var(--sage)', color: 'white', marginTop: 4,
        }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>&#10003;</div>
          <h3 style={{ color: 'white' }}>Great job today!</h3>
          <p style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>
            You completed all your planned meals. That's a win!
          </p>
        </div>
      )}

      {/* Food picker modal */}
      {showFoodPicker && (
        <FoodPicker foods={foods} onPick={addLoggedFood} onCancel={() => setShowFoodPicker(false)} />
      )}
    </div>
  );
}
