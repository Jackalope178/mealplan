import React from 'react';
import MacroRings from '../components/MacroRings';
import { getGoals, getWeekPlan, getWeekKey, getDayName, getLog, todayKey, getRecipes } from '../utils/storage';
import { getDailyQuote } from '../utils/quotes';

export default function HomeScreen({ onNavigate }) {
  const goals = getGoals();
  const weekKey = getWeekKey();
  const plan = getWeekPlan(weekKey);
  const today = getDayName(new Date());
  const todayPlan = plan[today] || {};
  const recipes = getRecipes();
  const log = getLog();
  const tk = todayKey();
  const todayLog = log.days?.[tk] || {};
  const quote = getDailyQuote();

  // Calculate today's consumed macros (from checked meals)
  const consumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const planned = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  ['breakfast', 'lunch', 'dinner', 'snack'].forEach(slot => {
    const recipeId = todayPlan[slot];
    if (!recipeId) return;
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe?.macros) return;
    planned.calories += recipe.macros.calories;
    planned.protein += recipe.macros.protein;
    planned.carbs += recipe.macros.carbs;
    planned.fat += recipe.macros.fat;
    if (todayLog[slot]) {
      consumed.calories += recipe.macros.calories;
      consumed.protein += recipe.macros.protein;
      consumed.carbs += recipe.macros.carbs;
      consumed.fat += recipe.macros.fat;
    }
  });

  const slotLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

  const hasPlan = Object.values(todayPlan).some(Boolean);

  return (
    <div className="screen-content">
      {/* Header */}
      <div className="fade-in" style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--sage-dark)', fontWeight: 800, fontSize: 32 }}>Nourish</h1>
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
          <div style={{
            marginTop: 16, padding: '12px 0', borderTop: '1px solid var(--cream-dark)',
          }}>
            {['breakfast', 'lunch', 'dinner', 'snack'].map(slot => {
              const recipeId = todayPlan[slot];
              if (!recipeId) return null;
              const recipe = recipes.find(r => r.id === recipeId);
              if (!recipe) return null;
              const checked = todayLog[slot];
              return (
                <div key={slot} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0',
                }}>
                  <div>
                    <span style={{
                      fontSize: 13, color: 'var(--text-light)', fontWeight: 600,
                      textTransform: 'uppercase', fontFamily: 'var(--font-display)',
                    }}>
                      {slotLabels[slot]}
                    </span>
                    <div style={{
                      fontSize: 16, fontWeight: 500,
                      textDecoration: checked ? 'line-through' : 'none',
                      opacity: checked ? 0.6 : 1,
                    }}>
                      {recipe.name}
                    </div>
                  </div>
                  {checked && (
                    <span className="check-bloom" style={{ color: 'var(--sage)', fontSize: 22 }}>
                      &#10003;
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!hasPlan && (
          <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-light)' }}>
            <p style={{ fontSize: 16, marginBottom: 12 }}>No meals planned for today yet.</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onNavigate('plan')}
            >
              Plan Today's Meals
            </button>
          </div>
        )}
      </div>

      {/* Streak */}
      {log.streak > 0 && (
        <div className="card fade-in" style={{
          animationDelay: '0.15s', textAlign: 'center',
          background: 'linear-gradient(135deg, var(--terracotta-light) 0%, var(--terracotta) 100%)',
          color: 'white',
        }}>
          <div style={{ fontSize: 36, fontFamily: 'var(--font-display)', fontWeight: 800 }}>
            {log.streak}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            day streak — keep it up!
          </div>
        </div>
      )}

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
