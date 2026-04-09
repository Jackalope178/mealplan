import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  fetchWeekPlan, upsertWeekPlan, fetchGoals, fetchRecipes,
} from '../utils/db';
import { getWeekKey, getWeekDates, getDayName, createEmptyWeek } from '../utils/storage';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DayMacroBar({ dayPlan, recipes, goals }) {
  let cals = 0;
  SLOTS.forEach(s => {
    const rid = dayPlan[s];
    if (!rid) return;
    const r = recipes.find(rx => rx.id === rid);
    if (r?.macros) cals += r.macros.calories;
  });
  const pct = Math.min(cals / (goals.calories || 1), 1);
  const color = pct > 0.85 && pct <= 1.1 ? 'var(--green)' : pct > 1.1 ? 'var(--red-soft)' : 'var(--amber)';
  return (
    <div className="progress-bar-track" style={{ height: 6, marginTop: 6 }}>
      <div className="progress-bar-fill" style={{ width: `${pct * 100}%`, background: color }} />
    </div>
  );
}

function RecipePicker({ onPick, onCancel, recipes, suggestions }) {
  const [search, setSearch] = useState('');
  const list = search
    ? recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : suggestions.length > 0 ? suggestions : recipes;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Choose a Recipe</h2>
          <button className="modal-close" onClick={onCancel}>&times;</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes..." style={{ marginBottom: 16 }} />
        {suggestions.length > 0 && !search && (
          <p style={{ fontSize: 14, color: 'var(--sage-dark)', marginBottom: 12, fontWeight: 600 }}>
            Suggested to match your macro goals:
          </p>
        )}
        {list.length === 0 && (
          <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 20 }}>
            No recipes found. Add some recipes first!
          </p>
        )}
        {list.map(r => (
          <button key={r.id} onClick={() => onPick(r.id)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', padding: '14px 16px', background: 'var(--cream)',
            borderRadius: 'var(--radius-sm)', marginBottom: 8, textAlign: 'left',
            border: 'none', cursor: 'pointer',
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{r.name}</div>
              {r.macros && (
                <div style={{ fontSize: 13, color: 'var(--text-light)', marginTop: 2 }}>
                  {r.macros.calories} cal · P{r.macros.protein}g · C{r.macros.carbs}g · F{r.macros.fat}g
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

function SwapNudge({ onSwap }) {
  return (
    <button onClick={onSwap} style={{
      background: 'var(--cream)', border: '1px dashed var(--sage-light)',
      borderRadius: 'var(--radius-sm)', padding: '8px 12px', width: '100%',
      fontSize: 14, color: 'var(--sage-dark)', cursor: 'pointer', marginTop: 4,
      fontFamily: 'var(--font-display)', fontWeight: 600,
    }}>
      Want a swap idea?
    </button>
  );
}

export default function PlanScreen({ userId }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [plan, setPlan] = useState(createEmptyWeek());
  const [recipes, setRecipes] = useState([]);
  const [goals, setGoals] = useState({ calories: 2000, protein: 120, carbs: 200, fat: 65 });
  const [picker, setPicker] = useState(null);
  const [showNudge, setShowNudge] = useState(null);
  const [loading, setLoading] = useState(true);
  const dragRef = useRef({ day: null, slot: null });

  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + weekOffset * 7);
  const weekKey = getWeekKey(currentDate);
  const weekDates = getWeekDates(currentDate);

  const loadData = useCallback(async () => {
    try {
      const [p, r, g] = await Promise.all([
        fetchWeekPlan(userId, weekKey),
        fetchRecipes(),
        fetchGoals(userId),
      ]);
      setPlan(p || createEmptyWeek());
      setRecipes(r);
      setGoals(g);
    } catch (err) {
      console.error('PlanScreen load error:', err);
    }
    setLoading(false);
  }, [userId, weekKey]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

  const savePlan = useCallback(async (newPlan) => {
    setPlan(newPlan);
    try {
      await upsertWeekPlan(userId, weekKey, newPlan);
    } catch (err) {
      console.error('Save plan error:', err);
    }
  }, [userId, weekKey]);

  const changeWeek = (delta) => {
    setWeekOffset(prev => prev + delta);
  };

  const assignMeal = (day, slot, recipeId) => {
    const newPlan = { ...plan, [day]: { ...plan[day], [slot]: recipeId } };
    savePlan(newPlan);
    setPicker(null);

    // Check if day is off-track
    const dayMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    SLOTS.forEach(s => {
      const rid = newPlan[day][s];
      if (!rid) return;
      const r = recipes.find(rx => rx.id === rid);
      if (r?.macros) {
        dayMacros.calories += r.macros.calories;
        dayMacros.protein += r.macros.protein;
        dayMacros.carbs += r.macros.carbs;
        dayMacros.fat += r.macros.fat;
      }
    });
    const hasEmpty = SLOTS.some(s => !newPlan[day][s]);
    if (dayMacros.calories > goals.calories * 1.05 && hasEmpty) {
      setShowNudge({ day, slot });
    } else {
      setShowNudge(null);
    }
  };

  const clearSlot = (day, slot) => {
    const newPlan = { ...plan, [day]: { ...plan[day], [slot]: null } };
    savePlan(newPlan);
  };

  const getSuggestions = (day) => {
    const current = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    SLOTS.forEach(s => {
      const rid = plan[day][s];
      if (!rid) return;
      const r = recipes.find(rx => rx.id === rid);
      if (r?.macros) {
        current.calories += r.macros.calories;
        current.protein += r.macros.protein;
        current.carbs += r.macros.carbs;
        current.fat += r.macros.fat;
      }
    });
    const remaining = {
      calories: Math.max(0, goals.calories - current.calories),
      protein: Math.max(0, goals.protein - current.protein),
      carbs: Math.max(0, goals.carbs - current.carbs),
      fat: Math.max(0, goals.fat - current.fat),
    };
    return recipes
      .filter(r => r.macros)
      .map(r => {
        const score =
          Math.abs((r.macros.calories || 0) - remaining.calories) +
          Math.abs((r.macros.protein || 0) - remaining.protein) * 2 +
          Math.abs((r.macros.carbs || 0) - remaining.carbs) +
          Math.abs((r.macros.fat || 0) - remaining.fat);
        return { ...r, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  };

  const handleDragStart = (day, slot) => { dragRef.current = { day, slot }; };
  const handleDrop = (targetDay, targetSlot) => {
    const { day: srcDay, slot: srcSlot } = dragRef.current;
    if (!srcDay) return;
    const srcRecipe = plan[srcDay][srcSlot];
    const targetRecipe = plan[targetDay][targetSlot];
    const newPlan = {
      ...plan,
      [srcDay]: { ...plan[srcDay], [srcSlot]: targetRecipe },
      [targetDay]: { ...plan[targetDay], [targetSlot]: srcRecipe },
    };
    savePlan(newPlan);
    dragRef.current = { day: null, slot: null };
  };

  const autoPlan = () => {
    const available = recipes.filter(r => r.macros);
    if (available.length === 0) {
      alert('Add some recipes with macros first to auto-plan your week!');
      return;
    }
    const newPlan = createEmptyWeek();
    DAYS.forEach(day => {
      const targetPerSlot = {
        calories: goals.calories / 4,
        protein: goals.protein / 4,
      };
      const usedInDay = new Set();
      SLOTS.forEach(slot => {
        let best = null;
        let bestScore = Infinity;
        available.forEach(r => {
          if (usedInDay.has(r.id)) return;
          const score =
            Math.abs(r.macros.calories - targetPerSlot.calories) +
            Math.abs(r.macros.protein - targetPerSlot.protein) * 2;
          if (score < bestScore) { bestScore = score; best = r; }
        });
        if (best) { newPlan[day][slot] = best.id; usedInDay.add(best.id); }
      });
    });
    savePlan(newPlan);
  };

  const todayName = getDayName(new Date());

  if (loading) {
    return (
      <div className="screen-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-light)' }}>Loading plan...</p>
      </div>
    );
  }

  return (
    <div className="screen-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1>Meal Plan</h1>
        <button className="btn btn-primary btn-sm" onClick={autoPlan}>Plan My Week</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '8px 0' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => changeWeek(-1)}>&larr; Prev</button>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>
          {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' – '}
          {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={() => changeWeek(1)}>Next &rarr;</button>
      </div>

      {DAYS.map((day, di) => {
        const isToday = day === todayName && weekOffset === 0;
        return (
          <div key={day} className="card fade-in" style={{
            animationDelay: `${di * 0.03}s`,
            border: isToday ? '2px solid var(--sage)' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 18 }}>
                {day}{' '}
                <span style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 400 }}>
                  {weekDates[di].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                {isToday && (
                  <span style={{
                    fontSize: 12, background: 'var(--sage)', color: 'white',
                    padding: '2px 8px', borderRadius: 8, marginLeft: 8, fontWeight: 600,
                  }}>Today</span>
                )}
              </h3>
            </div>

            {SLOTS.map(slot => {
              const recipeId = plan[day]?.[slot];
              const recipe = recipeId ? recipes.find(r => r.id === recipeId) : null;
              return (
                <div key={slot} draggable={!!recipe}
                  onDragStart={() => handleDragStart(day, slot)}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                  onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleDrop(day, slot); }}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', marginBottom: 4,
                    background: recipe ? 'var(--cream)' : 'transparent',
                    borderRadius: 'var(--radius-sm)',
                    border: recipe ? 'none' : '1px dashed var(--cream-dark)',
                    cursor: recipe ? 'grab' : 'pointer', minHeight: 48,
                  }}
                  onClick={() => { if (!recipe) setPicker({ day, slot }); }}
                >
                  <div>
                    <span style={{
                      fontSize: 12, color: 'var(--text-light)', fontWeight: 600,
                      textTransform: 'uppercase', fontFamily: 'var(--font-display)',
                    }}>{SLOT_LABELS[slot]}</span>
                    {recipe ? (
                      <div style={{ fontSize: 15, fontWeight: 500, marginTop: 2 }}>
                        {recipe.name}
                        {recipe.macros && (
                          <span style={{ fontSize: 12, color: 'var(--text-light)', marginLeft: 8 }}>
                            {recipe.macros.calories} cal
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 14, color: 'var(--warm-gray-light)', marginTop: 2 }}>Tap to add meal</div>
                    )}
                  </div>
                  {recipe && (
                    <button onClick={e => { e.stopPropagation(); clearSlot(day, slot); }}
                      style={{ background: 'none', border: 'none', color: 'var(--warm-gray-light)', fontSize: 18, padding: 4, cursor: 'pointer' }}>
                      &times;
                    </button>
                  )}
                </div>
              );
            })}

            {showNudge?.day === day && (
              <SwapNudge onSwap={() => {
                setPicker({ day, slot: showNudge.slot, suggestions: true });
                setShowNudge(null);
              }} />
            )}
            <DayMacroBar dayPlan={plan[day] || {}} recipes={recipes} goals={goals} />
          </div>
        );
      })}

      {picker && (
        <RecipePicker recipes={recipes}
          suggestions={picker.suggestions ? getSuggestions(picker.day) : []}
          onPick={(recipeId) => assignMeal(picker.day, picker.slot, recipeId)}
          onCancel={() => setPicker(null)} />
      )}
    </div>
  );
}
