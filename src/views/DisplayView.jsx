import React, { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Play, Pause, Gift, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getGymByCode } from '../lib/gym';
import { monthKey } from '../lib/admin';

const EXERCISES = ['Bench Press', 'Squats', 'Deadlifts'];

// Public gym screen: no sign-in. Lives at /display/<GYM-CODE>.
// Rotates between the live lift feed, best lifts per category (male / female),
// and sponsor ads. Refreshes from Supabase every 10 seconds.
export default function DisplayView({ code }) {
  const [gym, setGym] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [workouts, setWorkouts] = useState([]);
  const [profiles, setProfiles] = useState({});
  // Board ads come from the `ads` table (managed in the admin console).
  // While the giveaway is on, a giveaway ad joins the rotation automatically.
  // If a gym has no ads, the sponsor screen is skipped entirely.
  const [dbAds, setDbAds] = useState([]);
  const [winner, setWinner] = useState(null);
  const [winnerName, setWinnerName] = useState('');
  const [screenIdx, setScreenIdx] = useState(0);
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

  // Re-read the gym row every 30 seconds. Without this, the board only knew
  // the gym's settings from when the page first loaded — switching the
  // giveaway on (or changing its prize) in the admin console would never
  // show up until someone refreshed the page by hand.
  useEffect(() => {
    const t = setInterval(() => {
      getGymByCode(code).then((g) => {
        if (!g) return;
        setGym((prev) => {
          if (!prev) return g;
          const keys = ['name', 'logo_url', 'primary_color', 'giveaway_enabled', 'giveaway_prize'];
          return keys.some((k) => prev[k] !== g[k]) ? g : prev;
        });
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(t);
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

  // Board ads + this month's giveaway winner. Errors are ignored on purpose:
  // before migration 004 is run these tables don't exist yet, and the board
  // should still show lifts instead of failing.
  const loadBoardExtras = useCallback(async () => {
    if (!gym) return;
    const { data: adRows, error: adError } = await supabase
      .from('ads').select('*').eq('gym_id', gym.id).order('created_at');
    if (!adError) setDbAds(adRows || []);
    const { data: win, error: winError } = await supabase
      .from('giveaway_winners').select('*').eq('gym_id', gym.id).eq('month', monthKey())
      .order('drawn_at', { ascending: false }).limit(1).maybeSingle();
    if (!winError && win) {
      setWinner(win);
      const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', win.user_id).maybeSingle();
      setWinnerName(prof?.display_name || 'Member');
    } else {
      setWinner(null);
    }
  }, [gym]);

  useEffect(() => {
    loadBoardExtras();
    const t = setInterval(loadBoardExtras, 60000);
    return () => clearInterval(t);
  }, [loadBoardExtras]);

  const giveawayAd = gym?.giveaway_enabled
    ? {
        id: 'giveaway',
        title: 'Monthly Giveaway',
        prize: gym.giveaway_prize || null,
        description: 'Log a lift today and you’re automatically entered to win. One entry per day, drawn at the end of the month.',
        image_url: null,
      }
    : null;
  // The giveaway ad goes first in the rotation so it shows on the first ad
  // slot, ahead of the sponsor ads.
  const allAds = [...(giveawayAd ? [giveawayAd] : []), ...dbAds];
  // Rotation: live feed, best lifts, then a sponsor ad if there is one,
  // then the giveaway winner if one was drawn this month.
  const screens = ['live', 'best', ...(allAds.length ? ['ad'] : []), ...(winner ? ['winner'] : [])];
  const screen = screens[screenIdx % screens.length];
  const ad = allAds.length ? allAds[adIndex % allAds.length] : null;

  // Rotate screens every 12 seconds unless paused.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setScreenIdx((i) => (i + 1) % screens.length);
      setAdIndex((a) => (a + 1) % Math.max(1, allAds.length));
    }, 12000);
    return () => clearInterval(t);
  }, [paused, screens.length, allAds.length]);

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

        {screen === 'ad' && ad && ad.id === 'giveaway' && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
            <Gift className="w-16 h-16 text-amber-400" />
            <span className="text-xs px-3 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold tracking-widest">Monthly Giveaway</span>
            <h3 className="text-2xl font-bold text-slate-400 uppercase tracking-widest">This month&apos;s prize</h3>
            <p className="text-4xl font-black text-amber-400 leading-tight">{ad.prize || 'Prize to be announced'}</p>
            <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">{ad.description}</p>
          </div>
        )}

        {screen === 'ad' && ad && ad.id !== 'giveaway' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8">
            {ad.image_url ? (
              <img src={ad.image_url} alt={ad.title} className="w-full md:w-1/2 h-72 rounded-xl object-cover border border-slate-800 shadow-xl" />
            ) : (
              <div className="w-full md:w-1/2 h-72 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Gift className="w-20 h-20 text-amber-400" />
              </div>
            )}
            <div className="flex-1 space-y-4">
              <span className="text-xs px-3 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold tracking-widest">Local Community Sponsor</span>
              <h3 className="text-3xl font-black text-slate-100">{ad.title}</h3>
              <p className="text-lg text-slate-300 leading-relaxed">{ad.description}</p>
              <p className="text-xs text-slate-500 pt-2">Support local businesses that support {gym.name}!</p>
            </div>
          </div>
        )}

        {screen === 'winner' && winner && (
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-8 flex flex-col items-center gap-4 text-center">
            <Trophy className="w-16 h-16 text-amber-400" />
            <span className="text-xs px-3 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold tracking-widest">Monthly Giveaway Winner — {winner.month}</span>
            <h3 className="text-4xl font-black text-slate-100">{winnerName}</h3>
            {winner.prize && <p className="text-xl text-slate-300">Won: {winner.prize}</p>}
            <p className="text-sm text-slate-400">Log a lift to enter next month&apos;s draw.</p>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 px-6 py-3 flex items-center justify-between text-xs text-slate-400">
        <span>{gym.name} • IronBoard Kiosk</span>
        <span>
          {screen === 'live' ? 'Live feed'
            : screen === 'best' ? 'Best lifts'
            : screen === 'winner' ? `Giveaway winner: ${winnerName}`
            : ad?.id === 'giveaway' ? 'Monthly Giveaway'
            : ad ? `Sponsor: ${ad.title}` : 'Live feed'}
        </span>
      </footer>
    </div>
  );
}
