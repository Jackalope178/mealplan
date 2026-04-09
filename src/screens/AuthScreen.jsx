import React, { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: email, // We'll use magic link, but signUp needs a password
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin + '/mealplan/',
        },
      });
      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/mealplan/',
        },
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage('Check your email for a sign-in link!');
      }
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: 24, background: 'var(--cream)',
      maxWidth: 480, margin: '0 auto',
    }}>
      <div className="fade-in" style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontSize: 48, marginBottom: 8, lineHeight: 1,
          fontFamily: 'var(--font-display)', fontWeight: 800,
          color: 'var(--sage-dark)',
        }}>
          Nourish
        </div>
        <p style={{ color: 'var(--text-light)', fontSize: 18 }}>
          Your personal meal command center
        </p>
      </div>

      <div className="card fade-in" style={{ animationDelay: '0.1s' }}>
        <h2 style={{ marginBottom: 4 }}>
          {mode === 'signin' ? 'Welcome Back' : 'Create Your Account'}
        </h2>
        <p style={{ color: 'var(--text-light)', fontSize: 16, marginBottom: 24 }}>
          {mode === 'signin'
            ? "We'll send a sign-in link to your email — no password needed!"
            : 'Set up your account to save and share recipes.'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="What should we call you?"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          {error && (
            <p style={{
              color: 'var(--red-soft)', fontSize: 15, marginBottom: 16,
              padding: '10px 14px', background: '#FAE5E2', borderRadius: 'var(--radius-sm)',
            }}>
              {error}
            </p>
          )}

          {message && (
            <p style={{
              color: 'var(--sage-dark)', fontSize: 15, marginBottom: 16,
              padding: '10px 14px', background: '#E8F0E8', borderRadius: 'var(--radius-sm)',
            }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
            style={{ fontSize: 20, marginBottom: 12 }}
          >
            {loading ? 'Sending...' : mode === 'signin' ? 'Send Sign-In Link' : 'Create Account'}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null); }}
          style={{
            background: 'none', border: 'none', color: 'var(--sage-dark)',
            fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%',
            padding: 8, fontFamily: 'var(--font-display)',
          }}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
