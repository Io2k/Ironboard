import React, { useState } from 'react';
import { Dumbbell, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getGymByCode } from '../lib/gym';

// Sign in / sign up with email + password, then finish the member profile:
// display name, gender (for the male/female best-lift boards) and gym code.
export default function AuthView({ initialCode = '', initialMode = 'signin', onDone }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'profile'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState('male');
  const [gymCode, setGymCode] = useState(initialCode);
  const [gymPreview, setGymPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function checkCode(code) {
    setGymPreview(null);
    if (!code.trim()) return;
    try {
      const gym = await getGymByCode(code);
      setGymPreview(gym);
      if (!gym) setError('No gym uses that code. Check it and try again.');
      else setError('');
    } catch (e) {
      setError('Could not look up that gym code. Try again.');
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onDone();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If the project asks members to confirm their email, there is no
        // session yet — tell them to check their inbox.
        if (!data.session) {
          setNotice('Account created. Check your email for a confirmation link, then sign in.');
          setMode('signin');
        } else {
          setMode('profile');
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleProfile(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const gym = await getGymByCode(gymCode);
      if (!gym) throw new Error('No gym uses that code. Check it and try again.');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You are signed out. Sign in and try again.');
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: displayName.trim(),
        gender,
        gym_id: gym.id,
      });
      if (error) throw error;
      onDone();
    } catch (err) {
      setError(err.message || 'Could not save your profile. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide">
              IronBoard <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Member App</span>
            </h1>
            <p className="text-xs text-slate-400">Log your lifts. See them on the gym screen.</p>
          </div>
        </div>

        {mode === 'profile' ? (
          <form onSubmit={handleProfile} className="space-y-4 mt-6">
            <h2 className="text-xl font-bold">Finish your profile</h2>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Display name</label>
              <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Marcus Vance" required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gender (for the leaderboard boards)</label>
              <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym code</label>
              <input
                className={inputCls}
                value={gymCode}
                onChange={(e) => setGymCode(e.target.value.toUpperCase())}
                onBlur={(e) => checkCode(e.target.value)}
                placeholder="e.g. REPS-4K2D"
                required
              />
              {gymPreview && (
                <p className="text-xs text-emerald-400 mt-1">Joining {gymPreview.name}</p>
              )}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 disabled:opacity-50">
              {busy ? 'Saving…' : 'Join my gym'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4 mt-6">
            <h2 className="text-xl font-bold">{mode === 'signin' ? 'Sign in' : 'Create your account'}</h2>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Email</label>
              <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Password</label>
              <input type="password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            {mode === 'signup' && (
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym code (you can add it after too)</label>
                <input className={inputCls} value={gymCode} onChange={(e) => setGymCode(e.target.value.toUpperCase())} placeholder="e.g. REPS-4K2D" />
              </div>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            {notice && <p className="text-sm text-emerald-400">{notice}</p>}
            <button type="submit" disabled={busy} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50">
              {mode === 'signin' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <p className="text-center text-sm text-slate-400">
              {mode === 'signin' ? (
                <>No account yet? <button type="button" className="text-amber-400 font-semibold" onClick={() => setMode('signup')}>Create one</button></>
              ) : (
                <>Already have an account? <button type="button" className="text-amber-400 font-semibold" onClick={() => setMode('signin')}>Sign in</button></>
              )}
            </p>
            <p className="text-center text-xs text-slate-500">
              Own a gym? <a className="text-amber-400" href="/owner">Set up your gym</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
