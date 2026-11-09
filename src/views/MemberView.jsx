import React, { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Trophy, Tv, Settings, LogOut, Plus, Flame, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayUrl } from '../lib/gym';

const EXERCISES = ['Bench Press', 'Squats', 'Deadlifts'];

// Member app: log lifts to Supabase, see your history and the gym's live feed.
export default function MemberView({ user, profile, gym, onSignOut }) {
  const [workouts, setWorkouts] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState('Bench Press');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [shareWithGym, setShareWithGym] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadFeed = useCallback(async () => {
    if (!gym) return;
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('gym_id', gym.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setError('Could not load the gym feed.');
      setLoading(false);
      return;
    }
    setWorkouts(data || []);
    // Names come from profiles (no join is assumed, so fetch them directly).
    const ids = [...new Set((data || []).map((w) => w.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      const map = {};
      (profs || []).forEach((p) => { map[p.id] = p.display_name || 'Member'; });
      setNames(map);
    }
    setLoading(false);
  }, [gym]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  async function handleAddWorkout(e) {
    e.preventDefault();
    if (!weight || !reps) return;
    setSaving(true);
    setError('');
    const { error } = await supabase.from('workouts').insert({
      user_id: user.id,
      gym_id: gym.id,
      exercise,
      weight: Number(weight),
      reps: Number(reps),
      date: new Date().toISOString().split('T')[0],
      share_with_gym: shareWithGym,
    });
    if (error) {
      setError('Could not save that lift. Try again.');
      setSaving(false);
      return;
    }
    setWeight('');
    setReps('');
    await loadFeed();
    setSaving(false);
  }

  const myWorkouts = workouts.filter((w) => w.user_id === user.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Dumbbell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-wide flex items-center gap-2">
              {gym?.name || 'IronBoard'} <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">IronBoard</span>
            </h1>
            <p className="text-xs text-slate-400">{profile?.display_name || user.email} • Member Tracker</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={gym ? displayUrl(gym.code) : '/'} target="_blank" rel="noreferrer"
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 flex items-center gap-2 border border-slate-800">
            <Tv className="w-4 h-4" /> Gym screen
          </a>
          <a href="/owner" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 flex items-center gap-2 border border-slate-800">
            <Settings className="w-4 h-4" /> My gym
          </a>
          <button onClick={onSignOut} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 flex items-center gap-2 border border-slate-800">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" /> Log Personal Record
            </h2>
            <form onSubmit={handleAddWorkout} className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Select Lift</label>
                <select value={exercise} onChange={(e) => setExercise(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500">
                  {EXERCISES.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Weight (lbs)</label>
                <input type="number" placeholder="e.g. 315" value={weight} onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Reps</label>
                <input type="number" placeholder="1" value={reps} onChange={(e) => setReps(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500" />
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <input type="checkbox" id="shareGym" checked={shareWithGym} onChange={(e) => setShareWithGym(e.target.checked)}
                  className="w-5 h-5 accent-amber-500 rounded bg-slate-950 border-slate-800" />
                <label htmlFor="shareGym" className="text-sm text-slate-300">Share data with {gym?.name || 'gym'} TV Display</label>
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 mt-4 flex items-center justify-center gap-2 disabled:opacity-50">
                <Plus className="w-5 h-5" /> {saving ? 'Saving…' : 'Save & Broadcast PR'}
              </button>
            </form>
            {gym?.code && (
              <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-400" />
                Gym code <span className="font-bold text-slate-200">{gym.code}</span> — share it to invite members.
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> Recent Gym PR Feed
            </h2>
            {loading ? (
              <p className="text-slate-400 text-sm">Loading lifts…</p>
            ) : workouts.length === 0 ? (
              <p className="text-slate-400 text-sm">No lifts logged yet. Log the first one and it will show up here — and on the gym screen.</p>
            ) : (
              <div className="space-y-3">
                {workouts.filter((w) => w.share_with_gym !== false).map((w) => (
                  <div key={w.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                        {w.exercise === 'Bench Press' ? 'BP' : w.exercise === 'Squats' ? 'SQ' : 'DL'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200">{names[w.user_id] || 'Member'}</h4>
                        <p className="text-xs text-slate-400">{w.exercise} • {w.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-amber-400">{w.weight} lbs</span>
                      <p className="text-xs text-slate-400">{w.reps} {w.reps === 1 ? 'rep' : 'reps'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {myWorkouts.length > 0 && (
              <p className="text-xs text-slate-500 mt-4">Your lifts in this feed: {myWorkouts.length}</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
