import React, { useState } from 'react';
import { Settings, ArrowLeft, Search, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getGymByCode } from '../lib/gym';

// My Gym (member app): switch to a gym that already exists, by its code.
// This page never creates a gym — gyms are created on the separate owner
// page at /owner, which is not linked from the member app.
export default function MyGymView({ user, profile, gym }) {
  const [code, setCode] = useState('');
  const [found, setFound] = useState(null);
  const [looking, setLooking] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleFind(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setFound(null);
    if (!code.trim()) return;
    setLooking(true);
    try {
      const g = await getGymByCode(code);
      if (!g) {
        setError('No gym uses that code. Check it and try again.');
        return;
      }
      if (gym && g.id === gym.id) {
        setMessage(`You're already a member of ${g.name}.`);
        return;
      }
      setFound(g);
    } catch {
      setError('Could not look up that gym code. Try again.');
    } finally {
      setLooking(false);
    }
  }

  async function handleSwitch() {
    if (!found) return;
    setSwitching(true);
    setError('');
    const { error } = await supabase
      .from('profiles')
      .update({ gym_id: found.id })
      .eq('id', user.id);
    setSwitching(false);
    if (error) {
      setError('Could not switch gyms. Try again.');
      return;
    }
    // Reload the member app so it loads the new gym and its feed.
    window.location.href = '/';
  }

  const inputCls = 'w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide">My Gym</h1>
            <p className="text-xs text-slate-400">Switch to a gym that already exists.</p>
          </div>
        </div>
        <a href="/" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-800 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to member app
        </a>
      </header>

      <main className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-6">
        {gym && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Your current gym</p>
            <h2 className="text-2xl font-bold">{gym.name}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Code <span className="font-bold text-slate-200">{gym.code}</span>
              {profile?.display_name ? ` • ${profile.display_name}` : ''}
            </p>
          </div>
        )}

        <form onSubmit={handleFind} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h2 className="text-xl font-bold">Switch to another gym</h2>
          <p className="text-sm text-slate-400">
            Type the code for the gym you want to join. Your lifts come with you — switching gyms doesn&apos;t delete your history. Only lifts logged at a gym show on that gym&apos;s board.
          </p>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym code</label>
            <input
              className={inputCls}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. REPS-4K2D"
              autoCapitalize="characters"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          <button type="submit" disabled={looking || !code.trim()}
            className="w-full bg-slate-800 hover:bg-slate-700 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50">
            <Search className="w-5 h-5" /> {looking ? 'Looking up…' : 'Find gym'}
          </button>
        </form>

        {found && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Found</p>
              <h2 className="text-2xl font-bold">{found.name}</h2>
              <p className="text-sm text-slate-400 mt-1">Code {found.code}</p>
            </div>
            <button onClick={handleSwitch} disabled={switching}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50">
              <Check className="w-5 h-5" /> {switching ? 'Switching…' : `Switch to ${found.name}`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
