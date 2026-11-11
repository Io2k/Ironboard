import React, { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Trophy, Settings, LogOut, Plus, Flame, QrCode, Trash2, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { monthKey, todayKey } from '../lib/admin';

const EXERCISES = ['Bench Press', 'Squats', 'Deadlifts'];

// Member app: log lifts to Supabase, see your history and the gym's live feed.
export default function MemberView({ user, profile, gym, onSignOut }) {
  const [workouts, setWorkouts] = useState([]);
  const [myWorkouts, setMyWorkouts] = useState([]);
  const [gymNames, setGymNames] = useState({});
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState('Bench Press');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [shareWithGym, setShareWithGym] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // Monthly giveaway: 1 entry per day you log a lift, only while the gym
  // has it switched on (gyms.giveaway_enabled, migration 004).
  const [enteredToday, setEnteredToday] = useState(false);

  // The gym owner can remove any lift in their gym (e.g. a wrong entry on the TV screen).
  const isGymOwner = gym?.owner_id === user.id;
  const canDelete = (w) => w.user_id === user.id || isGymOwner;

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
    // Your lifts follow you: every lift records the gym it happened at
    // (workouts.gym_id), so load all of your lifts, not just this gym's.
    // The gym board still only shows lifts logged at that gym.
    const { data: mine } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setMyWorkouts(mine || []);
    const gymIds = [...new Set((mine || []).map((w) => w.gym_id).filter(Boolean))];
    if (gymIds.length) {
      const { data: gyms } = await supabase.from('gyms').select('id, name').in('id', gymIds);
      const gmap = {};
      (gyms || []).forEach((g) => { gmap[g.id] = g.name || 'Gym'; });
      setGymNames(gmap);
    }
    setLoading(false);
  }, [gym, user.id]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Are you already entered in today's giveaway draw?
  useEffect(() => {
    if (!gym?.giveaway_enabled) {
      setEnteredToday(false);
      return;
    }
    supabase
      .from('giveaway_entries')
      .select('id')
      .eq('gym_id', gym.id)
      .eq('user_id', user.id)
      .eq('entry_date', todayKey())
      .maybeSingle()
      .then(({ data }) => setEnteredToday(!!data))
      .catch(() => {});
  }, [gym, user.id]);

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
    // Giveaway entry: one per day. The database's unique rule ignores a
    // second entry the same day, so logging twice never double-enters you.
    if (gym?.giveaway_enabled) {
      const { error: entryError } = await supabase
        .from('giveaway_entries')
        .upsert(
          { gym_id: gym.id, user_id: user.id, entry_date: todayKey() },
          { onConflict: 'gym_id,user_id,entry_date', ignoreDuplicates: true }
        );
      if (!entryError) setEnteredToday(true);
    }
    setWeight('');
    setReps('');
    await loadFeed();
    setSaving(false);
  }

  // Two taps: first tap arms the confirm, second tap deletes for good.
  // The delete only succeeds if the database allows it (see migration 002:
  // you can delete your own lifts, and a gym owner can delete any lift in
  // their gym). If the row comes back empty, the rule isn't in place yet.
  async function handleDeleteWorkout(w) {
    if (confirmDeleteId !== w.id) {
      setConfirmDeleteId(w.id);
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(w.id);
    setError('');
    const { data, error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', w.id)
      .select('id');
    setDeletingId(null);
    if (error) {
      setError('Could not delete that lift. Try again.');
      return;
    }
    if (!data || data.length === 0) {
      setError('Could not delete that lift — the delete rule has not been set up in Supabase yet (migration 002).');
      return;
    }
    await loadFeed();
  }

  // One lift card, used in both the gym feed and your own history.
  // showGym labels which gym the lift happened at (for lifts from other gyms).
  function LiftCard({ w, showGym }) {
    return (
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            {w.exercise === 'Bench Press' ? 'BP' : w.exercise === 'Squats' ? 'SQ' : 'DL'}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-200">{names[w.user_id] || 'Member'}</h4>
            <p className="text-xs text-slate-400">{w.exercise} • {w.date}</p>
            {showGym && gymNames[w.gym_id] && (
              <p className="text-xs text-slate-500 mt-0.5">{gymNames[w.gym_id]}</p>
            )}
            {w.share_with_gym === false && w.user_id === user.id && (
              <p className="text-xs text-slate-500 mt-0.5">Private — only you can see this</p>
            )}
          </div>
        </div>
        {/* Weight and reps sit above the Delete button, stacked
            vertically, so the row isn't squeezed side-by-side on a phone. */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <span className="text-xl sm:text-2xl font-extrabold text-amber-400 whitespace-nowrap">{w.weight} lbs</span>
            <p className="text-xs text-slate-400">{w.reps} {w.reps === 1 ? 'rep' : 'reps'}</p>
          </div>
          {canDelete(w) && (
            <button
              type="button"
              onClick={() => handleDeleteWorkout(w)}
              disabled={deletingId === w.id}
              title={confirmDeleteId === w.id ? 'Tap again to confirm delete' : 'Delete this lift'}
              className={`px-2.5 py-2 rounded-lg text-sm font-medium border flex items-center gap-1.5 disabled:opacity-50 ${
                confirmDeleteId === w.id
                  ? 'bg-red-500/20 text-red-300 border-red-500/50'
                  : 'text-slate-400 hover:text-red-300 border-slate-800 hover:border-red-500/40'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              {deletingId === w.id ? 'Deleting…' : confirmDeleteId === w.id ? 'Sure?' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto w-full">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-black text-2xl sm:text-3xl tracking-wide leading-tight min-w-0">
              {gym?.name || 'IronBoard'}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <a href="/my-gym" className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 flex items-center gap-2 border border-slate-800">
                <Settings className="w-4 h-4" /> My gym
              </a>
              <button onClick={onSignOut} className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-slate-100 flex items-center gap-2 border border-slate-800">
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3">
            {gym?.logo_url ? (
              <img src={gym.logo_url} alt={`${gym.name || 'Gym'} logo`} className="w-10 h-10 rounded-lg object-cover border border-amber-500/50" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Dumbbell className="w-6 h-6" />
              </div>
            )}
            <span className="font-bold text-lg tracking-wide">IronBoard</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">{profile?.display_name || user.email} • Member Tracker</p>
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
            {gym?.giveaway_enabled && (
              <div className="mt-6 pt-4 border-t border-slate-800">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                  <Gift className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-100">Monthly giveaway — {monthKey()}</p>
                    {gym.giveaway_prize && <p className="text-sm text-slate-300 mt-0.5">This month&apos;s prize: {gym.giveaway_prize}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      {enteredToday
                        ? 'You’re entered for this month — log a lift again tomorrow for another entry.'
                        : 'Log a lift today and you’re automatically entered (1 entry per day).'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" /> At {gym?.name || 'your gym'}
            </h2>
            {loading ? (
              <p className="text-slate-400 text-sm">Loading lifts…</p>
            ) : workouts.length === 0 ? (
              <p className="text-slate-400 text-sm">No lifts logged yet. Log the first one and it will show up here — and on the gym screen.</p>
            ) : (
              <div className="space-y-3">
                {workouts
                  // Your own lifts show here even if you kept them private,
                  // so you can always delete one — other members only see shared lifts.
                  .filter((w) => w.share_with_gym !== false || w.user_id === user.id)
                  .map((w) => <LiftCard key={w.id} w={w} showGym={false} />)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mt-8">
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-amber-500" /> My lifts
          </h2>
          <p className="text-xs text-slate-400 mb-4">Your lifts from all your gyms — they stay with you if you switch gyms. Only lifts logged at a gym show on that gym&apos;s board.</p>
          {loading ? (
            <p className="text-slate-400 text-sm">Loading lifts…</p>
          ) : myWorkouts.length === 0 ? (
            <p className="text-slate-400 text-sm">No lifts logged yet.</p>
          ) : (
            <div className="space-y-3">
              {myWorkouts.map((w) => <LiftCard key={w.id} w={w} showGym />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
