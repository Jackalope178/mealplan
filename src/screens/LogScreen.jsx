import React, { useState, useEffect } from 'react';
import {
  getGoals, getWeekPlan, getWeekKey, getDayName,
  getRecipes, getLog, saveLog, todayKey,
} from '../utils/storage';
import { getDailyQuote } from '../utils/quotes';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

function calculateStreak(log, goals, recipes, todayChecked) {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayLog = i === 0 ? todayChecked : log.days?.[key];

    if (!dayLog) break;

    // Check if all planned meals were checked
    const weekKey = getWeekKey(d);
    const plan = getWeekPlan(weekKey);
    const dayName = getDayName(d);
    const dayPlan = plan[dayName] || {};

    const plannedSlots = SLOTS.filter(s => dayPlan[s]);
    if (plannedSlots.length === 0) {
      // No plan for this day – skip but don't break streak
      if (i === 0) continue;
      break;
    }

    const allChecked = plannedSlots.every(s => dayLog[s]);
    if (!allChecked) break;

    // Check if macros were within target
    let dayMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    plannedSlots.forEach(s => {
      const r = recipes.find(rx => rx.id === dayPlan[s]);
      if (r?.macros) {
        dayMacros.calories += r.macros.calories;
        dayMacros.protein += r.macros.protein;
        dayMacros.carbs += r.macros.carbs;
        dayMacros.fat += r.macros.fat;
      }
    });

    // Within 15% of targets counts as hitting goals
    const withinTarget =
      dayMacros.calories <= goals.calories * 1.15 &&
      dayMacros.protein >= goals.protein * 0.85;

    if (withinTarget) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export default function LogScreen() {
  const tk = todayKey();
  const goals = getGoals();
  const recipes = getRecipes();
  const weekKey = getWeekKey();
  const plan = getWeekPlan(weekKey);
  const today = getDayName(new Date());
  const todayPlan = plan[today] || {};
  const quote = getDailyQuote();

  const [log, setLog] = useState(getLog());
  const todayLog = log.days?.[tk] || {};
  const [justChecked, setJustChecked] = useState(null);

  const toggleMeal = (slot) => {
    const newTodayLog = { ...todayLog, [slot]: !todayLog[slot] };
    const newLog = {
      ...log,
      days: { ...log.days, [tk]: newTodayLog },
    };

    // Recalculate streak
    newLog.streak = calculateStreak(newLog, goals, recipes, newTodayLog);
    setLog(newLog);
    saveLog(newLog);

    if (!todayLog[slot]) {
      setJustChecked(slot);
      setTimeout(() => setJustChecked(null), 600);
    }
  };

  const plannedMeals = SLOTS.filter(s => todayPlan[s]);
  const checkedCount = plannedMeals.filter(s => todayLog[s]).length;
  const progressPct = plannedMeals.length > 0 ? checkedCount / plannedMeals.length : 0;

  // Today's consumed macros
  const consumed = { calories: 0, protein: 0, carbs: 0, fat: 0 };
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
      <div className="card fade-in" style={{
        animationDelay: '0.05s', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 48, fontFamily: 'var(--font-display)', fontWeight: 800,
          color: log.streak > 0 ? 'var(--terracotta)' : 'var(--warm-gray-light)',
        }}>
          {log.streak}
        </div>
        <div style={{ fontSize: 16, color: 'var(--text-light)', fontWeight: 600 }}>
          {log.streak === 1 ? 'day streak' : 'day streak'}
        </div>
        {log.streak >= 3 && (
          <div style={{
            marginTop: 8, fontSize: 14, color: 'var(--sage-dark)', fontWeight: 600,
          }}>
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
            color: progressPct === 1 ? 'var(--sage)' : 'var(--text-light)',
          }}>
            {checkedCount} / {plannedMeals.length}
          </span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{
            width: `${progressPct * 100}%`,
            background: progressPct === 1 ? 'var(--green)' : 'var(--amber)',
          }} />
        </div>

        {/* Macro summary */}
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

      {/* Meal checklist */}
      <div className="fade-in" style={{ animationDelay: '0.15s' }}>
        {plannedMeals.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text-light)' }}>
            <p>No meals planned for today. Head to the Plan tab to set up your day!</p>
          </div>
        ) : (
          plannedMeals.map(slot => {
            const recipe = recipes.find(r => r.id === todayPlan[slot]);
            if (!recipe) return null;
            const checked = todayLog[slot];

            return (
              <div key={slot} className="card" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                opacity: checked ? 0.7 : 1,
                transition: 'opacity 0.3s',
              }}>
                <button
                  onClick={() => toggleMeal(slot)}
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    border: `3px solid ${checked ? 'var(--sage)' : 'var(--cream-dark)'}`,
                    background: checked ? 'var(--sage)' : 'var(--white)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, transition: 'all 0.3s',
                    cursor: 'pointer',
                  }}
                >
                  {checked && (
                    <span className={justChecked === slot ? 'check-bloom' : ''} style={{
                      color: 'white', fontSize: 24, fontWeight: 700,
                    }}>
                      &#10003;
                    </span>
                  )}
                </button>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13, color: 'var(--text-light)', fontWeight: 600,
                    textTransform: 'uppercase', fontFamily: 'var(--font-display)',
                  }}>
                    {SLOT_LABELS[slot]}
                  </div>
                  <div style={{
                    fontSize: 17, fontWeight: 600,
                    textDecoration: checked ? 'line-through' : 'none',
                  }}>
                    {recipe.name}
                  </div>
                  {recipe.macros && (
                    <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>
                      {recipe.macros.calories} cal · P{recipe.macros.protein}g · C{recipe.macros.carbs}g · F{recipe.macros.fat}g
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Completion message */}
      {progressPct === 1 && plannedMeals.length > 0 && (
        <div className="card fade-in" style={{
          textAlign: 'center', background: 'var(--sage)',
          color: 'white', marginTop: 4,
        }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>&#10003;</div>
          <h3 style={{ color: 'white' }}>Great job today!</h3>
          <p style={{ fontSize: 15, opacity: 0.9, marginTop: 4 }}>
            You completed all your planned meals. That's a win!
          </p>
        </div>
      )}
    </div>
  );
}
