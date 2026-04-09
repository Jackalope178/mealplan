import React, { useState, useEffect } from 'react';
import MacroRings from '../components/MacroRings';
import { fetchGoals, fetchRecipes, fetchWeekPlan, fetchDailyLog } from '../utils/db';
import { getWeekKey, getDayName, todayKey } from '../utils/storage';
import { getDailyQuote } from '../utils/quotes';

export default function HomeScreen({ userId, userName, onNavigate }) {
  const [goals, setGoals] = useState({ calories: 2000, protein: 120, carbs: 200, fat: 65 });
  const [recipes, setRecipes] = useState([]);
  const [todayPlan, setTodayPlan] = useState({});
  const [todayLog, setTodayLog] = useState({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const quote = getDailyQuote();
  const tk = todayKey();
  const today = getDayName(new Date());
  const weekKey = getWeekKey();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [g, r, plan, log] = await Promise.all([
          fetchGoals(userId),
          fetchRecipes(),
          fetchWeekPlan(userId, weekKey),
          fetchDailyLog(userId, tk),
        ]);
        if (!active) return;
        setGoals(g);
        setRecipes(r);
        setTodayPlan(plan?.[today] || {});
        setTodayLog(log || {});
      } catch (err) {
        console.error('HomeScreen load error:', err);
      }
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [userId, weekKey, tk, today]);

  // Calculate today's consumed macros
  const consumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const slots = ['breakfast', 'lunch', 'dinner', 'snack'];
  const slotLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

  slots.forEach(slot => {
    const recipeId = todayPlan[slot];
    if (!recipeId) return;
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe?.macros || !todayLog[slot]) return;
    consumed.calories += recipe.macros.calories;
    consumed.protein += recipe.macros.protein;
    consumed.carbs += recipe.macros.carbs;
    consumed.fat += recipe.macros.fat;
  });

  const hasPlan = Object.values(todayPlan).some(Boolean);
  const greeting = userName ? `Hi, ${userName}!` : 'Welcome!';

  if (loading) {
    return (
      <div className="screen-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="screen-content">
      <div className="fade-in" style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--sage-dark)', fontWeight: 800, fontSize: 32 }}>{greeting}</h1>
      </div>

      {/* Daily quote */}
      <div className="card fade-in" style={{
        background: 'linear-gradient(135deg, var(--sage-light) 0%, var(--sage) 100%)',
        color: 'white', textAlign: 'center',
      }}>
        <p style={{ fontSize: 16, fontStyle: 'italic', lineHeight: 1.5, marginBottom: 8 }}>
          "{quote.text}"
        </p>
        <p style={{ fontSize: 13, opacity: 0.85 }}>— {quote.author}</p>
      </div>

      {/* How am I doing today */}
      <div className="card fade-in" style={{ animationDelay: '0.1s' }}>
        <h3 style={{ marginBottom: 16 }}>How am I doing today?</h3>
        <MacroRings current={consumed} goals={goals} />
        {hasPlan && (
          <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--cream-dark)' }}>
            {slots.map(slot => {
              const recipeId = todayPlan[slot];
              if (!recipeId) return null;
              const recipe = recipes.find(r => r.id === recipeId);
              if (!recipe) return null;
              const checked = todayLog[slot];
              return (
                <div key={slot} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0',
                }}>
                  <div>
                    <span style={{
                      fontSize: 13, color: 'var(--text-light)', fontWeight: 600,
                      textTransform: 'uppercase', fontFamily: 'var(--font-display)',
                    }}>{slotLabels[slot]}</span>
                    <div style={{
                      fontSize: 16, fontWeight: 500,
                      textDecoration: checked ? 'line-through' : 'none',
                      opacity: checked ? 0.6 : 1,
                    }}>{recipe.name}</div>
                  </div>
                  {checked && (
                    <span className="check-bloom" style={{ color: 'var(--sage)', fontSize: 22 }}>&#10003;</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!hasPlan && (
          <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-light)' }}>
            <p style={{ fontSize: 16, marginBottom: 12 }}>No meals planned for today yet.</p>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('plan')}>
              Plan Today's Meals
            </button>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="fade-in" style={{
        animationDelay: '0.2s', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      }}>
        <button className="btn btn-secondary btn-full" onClick={() => onNavigate('recipes')}>
          My Recipes
        </button>
        <button className="btn btn-secondary btn-full" onClick={() => onNavigate('log')}>
          Today's Log
        </button>
      </div>
    </div>
  );
}
