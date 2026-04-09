import React from 'react';

function Ring({ value, max, color, label, size = 80, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--cream-dark)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ textAlign: 'center', marginTop: -size / 2 - 14 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-light)', fontWeight: 600 }}>
          / {max}
        </div>
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-light)',
        fontFamily: 'var(--font-display)', marginTop: size / 2 - 18,
      }}>
        {label}
      </div>
    </div>
  );
}

export default function MacroRings({ current, goals }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-around', padding: '8px 0' }}>
      <Ring value={current.calories} max={goals.calories} color="var(--cal-color)" label="Cal" />
      <Ring value={current.protein} max={goals.protein} color="var(--protein-color)" label="Protein" />
      <Ring value={current.carbs} max={goals.carbs} color="var(--carb-color)" label="Carbs" />
      <Ring value={current.fat} max={goals.fat} color="var(--fat-color)" label="Fat" />
    </div>
  );
}
