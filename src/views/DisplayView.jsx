import React, { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Play, Pause } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getGymByCode } from '../lib/gym';

const EXERCISES = ['Bench Press', 'Squats', 'Deadlifts'];

// Sponsor ads shown on rotation. Owners will be able to edit these later.
const DEFAULT_ADS = [
  { id: 1, title: 'Apex Meal Prep', description: 'Fresh macro-counted meals delivered directly to your gym weekly.', image_url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80' },
  { id: 2, title: 'Eunice Physical Therapy & Sports Rehab', description: 'Get back under the bar faster. Zero wait times for local lifters.', image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80' },
];

// Public gym screen: no sign-in. Lives at /display/<GYM-CODE>.
// Rotates between the live lift feed, best lifts per category (male / female),
// and sponsor ads. Refreshes from Supabase every 10 seconds.
export default function DisplayView({ code }) {
  const [gym, setGym] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [screen, setScreen] = useState('live'); // 'live' | 'best' | 'ad'
  const [adIndex, setAdIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGymByCode(code).then((g) => {
      if (cancelled) return;
      if (!g) setNotFound(true);
      else setGym(g);
    }).catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [code]);

  const loadWorkouts = useCallback(async () => {
    if (!gym) return;
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('gym_id', gym.id)
      .eq('share_with_gym', true)
      .order('created_at', { ascending: false })
      .limit(100);
    if (!data) return;
    setWorkouts(data);
    const ids = [...new Set(data.map((w) => w.user_id))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, gender').in('id', ids);
      const map = {};
      (profs || []).forEach((p) => { map[p.id] = p; });
      setProfiles(map);
    }
  }, [gym]);

  useEffect(() => {
    loadWorkouts();
    const t = setInterval(loadWorkouts, 10000);
    return () => clearInterval(t);
  }, [loadWorkouts]);

  // Rotate screens every 12 seconds unless paused.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setScreen((prev) => {
        if (prev === 'live') return 'best';
        if (prev === 'best') {
          setAdIndex((i) => (i + 1) % DEFAULT_ADS.length);
          return 'ad';
        }
        return 'live';
      });
    }, 12000);
    return () => clearInterval(t);
  }, [paused]);

  function bestLift(exercise, gender) {
    const lifts = workouts.filter((w) => {
      if (w.exercise !== exercise) return false;
      const p = profiles[w.user_id];
      return p && p.gender === gender;
    });
    if (!lifts.length) return null;
    return lifts.reduce((a, b) => (b.weight > a.weight ? b : a));
  }

  const accent = gym?.primary_color || '#f59e0b';

  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans p-6">
        <div className="text-center">
          <Dumbbell className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Gym not found</h1>
          <p className="text-slate-400">No gym uses the code “{code}”. Check the link on the gym screen.</p>
        </div>
      </div>
    );
  }

  if (!gym) {
    return <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans"><p className="text-slate-400">Loading the gym screen…</p></div>;
  }

  const ad = DEFAULT_ADS[adIndex];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {gym.logo_url ? (
            <img src={gym.logo_url} alt="Gym Logo" className="w-10 h-10 rounded-lg object-cover border border-amber-500/50" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Dumbbell className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-2xl tracking-wide" style={{ color: accent }}>{gym.name} LIVE LEADERBOARD</h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Bench Press • Squats • Deadlifts</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">● LIVE</span>
          <button onClick={() => setPaused(!paused)} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-200 transition" title={paused ? 'Resume rotation' : 'Pause rotation'}>
            {paused ? <Play className="w-5 h-5 text-amber-400" /> : <Pause className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col justify-center">
        {screen === 'live' && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">Live lift feed</h2>
            {workouts.length === 0 ? (
              <p className="text-slate-400 text-lg">No lifts shared yet. Members’ lifts will show up here as they log them.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workouts.slice(0, 8).map((w) => (
                  <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xl text-slate-200">{profiles[w.user_id]?.display_name || 'Member'}</h4>
                      <p className="text-sm text-slate-400">{w.exercise} • {w.date}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-extrabold text-amber-400">{w.weight} lbs</span>
                      <p className="text-sm text-slate-400">{w.reps} {w.reps === 1 ? 'rep' : 'reps'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {screen === 'best' && (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">Best lifts by category</h2>
            <div className="space-y-8">
              {['male', 'female'].map((gender) => (
                <div key={gender}>
                  <h3 className="text-lg font-bold mb-3 capitalize">{gender === 'male' ? 'Men' : 'Women'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {EXERCISES.map((ex) => {
                      const top = bestLift(ex, gender);
                      return (
                        <div key={ex} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                          <h4 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-2">{ex} Record</h4>
                          {top ? (
                            <div>
                              <div className="text-4xl font-black text-amber-400 mb-1">{top.weight} <span className="text-lg font-normal text-slate-400">lbs</span></div>
                              <p className="text-slate-200 font-semibold text-lg">{profiles[top.user_id]?.display_name || 'Member'}</p>
                              <p className="text-xs text-slate-500 mt-1">{top.reps} reps • {top.date}</p>
                            </div>
                          ) : (
                            <p className="text-slate-500 text-sm italic">No lifts recorded yet</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === 'ad' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
            <img src={ad.image_url} alt={ad.title} className="w-full md:w-1/2 h-72 rounded-xl object-cover border border-slate-800 shadow-xl" />
            <div className="flex-1 space-y-4">
              <span className="text-xs px-3 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold tracking-widest">Local Community Sponsor</span>
              <h3 className="text-3xl font-black text-slate-100">{ad.title}</h3>
              <p className="text-lg text-slate-300 leading-relaxed">{ad.description}</p>
              <p className="text-xs text-slate-500 pt-2">Support local businesses that support {gym.name}!</p>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
        <span>{gym.name} • IronBoard Kiosk</span>
        <span>{screen === 'live' ? 'Live feed' : screen === 'best' ? 'Best lifts' : `Sponsor: ${ad.title}`}</span>
      </footer>
    </div>
  );
}
