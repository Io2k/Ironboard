import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Dumbbell, Trophy, Tv, Settings, User, LogOut, Plus, 
  CheckCircle, Play, Pause, ChevronRight, Sparkles, Building2, Flame
} from 'lucide-react';

// Initialize Supabase Client from Netlify Environment Variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function App() {
  const [view, setView] = useState('tracker'); // 'tracker', 'tv', 'settings'
  const [user, setUser] = useState(null);
  const [gym, setGym] = useState({
    name: 'REPS Gym',
    logo_url: '',
    primary_color: '#f59e0b'
  });
  
  // Workouts State
  const [workouts, setWorkouts] = useState([
    { id: 1, user_name: 'Marcus "The Tank" Vance', exercise: 'Bench Press', weight: 405, reps: 1, date: '2026-11-05', share_with_gym: true },
    { id: 2, user_name: 'Sarah Jenkins', exercise: 'Squats', weight: 315, reps: 3, date: '2026-11-05', share_with_gym: true },
    { id: 3, user_name: 'David Miller', exercise: 'Deadlifts', weight: 500, reps: 1, date: '2026-11-04', share_with_gym: true },
    { id: 4, user_name: 'Elena Rostova', exercise: 'Bench Press', weight: 225, reps: 5, date: '2026-11-04', share_with_gym: true }
  ]);

  // Ads State
  const [ads, setAds] = useState([
    { id: 1, title: 'Apex Meal Prep', description: 'Fresh macro-counted meals delivered directly to REPS Gym weekly.', image_url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=800&q=80' },
    { id: 2, title: 'Eunice Physical Therapy & Sports Rehab', description: 'Get back under the bar faster. Zero wait times for local lifters.', image_url: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80' }
  ]);

  // New Workout Form
  const [exercise, setExercise] = useState('Bench Press');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [shareWithGym, setShareWithGym] = useState(true);

  // TV Kiosk Rotation State
  const [tvMode, setTvMode] = useState('leaderboard'); // 'leaderboard' or 'ad'
  const [tvPaused, setTvPaused] = useState(false);
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  // Auto-switch TV view between Leaderboard and Ads every 10 seconds
  useEffect(() => {
    if (view !== 'tv' || tvPaused) return;
    const interval = setInterval(() => {
      setTvMode((prev) => {
        if (prev === 'leaderboard') {
          return 'ad';
        } else {
          setCurrentAdIndex((current) => (current + 1) % ads.length);
          return 'leaderboard';
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [view, tvPaused, ads.length]);

  const handleAddWorkout = (e) => {
    e.preventDefault();
    if (!weight || !reps) return;
    const newEntry = {
      id: Date.now(),
      user_name: user ? user.email.split('@')[0] : 'Guest Lifter',
      exercise,
      weight: Number(weight),
      reps: Number(reps),
      date: new Date().toISOString().split('T')[0],
      share_with_gym: shareWithGym
    };
    setWorkouts([newEntry, ...workouts]);
    setWeight('');
    setReps('');
    alert('Workout logged successfully!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* HEADER NAVBAR */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {gym.logo_url ? (
            <img src={gym.logo_url} alt="Gym Logo" className="w-10 h-10 rounded-lg object-cover border border-amber-500/50" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Dumbbell className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg tracking-wide flex items-center gap-2">
              {gym.name} <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">IronBoard</span>
            </h1>
            <p className="text-xs text-slate-400">Digital Whiteboard & PR Tracker</p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button 
            onClick={() => setView('tracker')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${view === 'tracker' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <User className="w-4 h-4" /> Member Tracker
          </button>
          <button 
            onClick={() => setView('tv')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${view === 'tv' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Tv className="w-4 h-4" /> TV Kiosk Display
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${view === 'settings' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Settings className="w-4 h-4" /> Gym Settings
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        
        {/* VIEW 1: MEMBER TRACKER */}
        {view === 'tracker' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Log Lift Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-500" /> Log Personal Record
              </h2>
              <form onSubmit={handleAddWorkout} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Select Lift</label>
                  <select 
                    value={exercise} 
                    onChange={(e) => setExercise(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="Bench Press">Bench Press</option>
                    <option value="Squats">Squats</option>
                    <option value="Deadlifts">Deadlifts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Weight (lbs)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 315" 
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Reps</label>
                  <input 
                    type="number" 
                    placeholder="1" 
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="flex items-center space-x-3 pt-2">
                  <input 
                    type="checkbox" 
                    id="shareGym"
                    checked={shareWithGym}
                    onChange={(e) => setShareWithGym(e.target.checked)}
                    className="w-5 h-5 accent-amber-500 rounded bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="shareGym" className="text-sm text-slate-300">Share data with {gym.name} TV Display</label>
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20 mt-4 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Save & Broadcast PR
                </button>
              </form>
            </div>

            {/* Recent Feeds / Leaderboard Preview */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Recent Gym PR Feed
              </h2>
              <div className="space-y-3">
                {workouts.map((w) => (
                  <div key={w.id} className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                        {w.exercise === 'Bench Press' ? 'BP' : w.exercise === 'Squats' ? 'SQ' : 'DL'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-200">{w.user_name}</h4>
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
            </div>
          </div>
        )}

        {/* VIEW 2: TV KIOSK DISPLAY (100vh Single Screen Mode) */}
        {view === 'tv' && (
          <div className="h-[calc(100vh-140px)] bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col justify-between shadow-2xl overflow-hidden relative">
            
            {/* TV Header Controls */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-4">
                {gym.logo_url && <img src={gym.logo_url} alt="Logo" className="w-12 h-12 rounded-xl object-cover border border-amber-500" />}
                <div>
                  <h2 className="text-2xl font-extrabold tracking-wider text-amber-400">{gym.name} LIVE LEADERBOARD</h2>
                  <p className="text-xs text-slate-400 uppercase tracking-widest">Bench Press • Squats • Deadlifts</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse">● LIVE TV FEED</span>
                <button 
                  onClick={() => setTvPaused(!tvPaused)} 
                  className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-200 transition"
                  title={tvPaused ? 'Resume Rotation' : 'Pause Rotation'}
                >
                  {tvPaused ? <Play className="w-5 h-5 text-amber-400" /> : <Pause className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* TV Content Body: Alternates between Leaderboard and Ads */}
            <div className="flex-1 my-6 flex flex-col justify-center overflow-hidden">
              {tvMode === 'leaderboard' ? (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-2">Top Lifts Leaderboard</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['Bench Press', 'Squats', 'Deadlifts'].map((ex) => {
                      const topLift = workouts.filter(w => w.exercise === ex).sort((a,b) => b.weight - a.weight)[0];
                      return (
                        <div key={ex} className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl"></div>
                          <h4 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-2">{ex} Record</h4>
                          {topLift ? (
                            <div>
                              <div className="text-4xl font-black text-amber-400 mb-1">{topLift.weight} <span className="text-lg font-normal text-slate-400">lbs</span></div>
                              <p className="text-slate-200 font-semibold text-lg">{topLift.user_name}</p>
                              <p className="text-xs text-slate-500 mt-1">{topLift.reps} reps • {topLift.date}</p>
                            </div>
                          ) : (
                            <p className="text-slate-500 text-sm italic">No lifts recorded yet</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 animate-fade-in">
                  <img 
                    src={ads[currentAdIndex].image_url} 
                    alt={ads[currentAdIndex].title} 
                    className="w-full md:w-1/2 h-72 rounded-xl object-cover border border-slate-800 shadow-xl"
                  />
                  <div className="flex-1 space-y-4">
                    <span className="text-xs px-3 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold tracking-widest">Local Community Sponsor</span>
                    <h3 className="text-3xl font-black text-slate-100">{ads[currentAdIndex].title}</h3>
                    <p className="text-lg text-slate-300 leading-relaxed">{ads[currentAdIndex].description}</p>
                    <p className="text-xs text-slate-500 pt-2">Support local businesses that support {gym.name}!</p>
                  </div>
                </div>
              )}
            </div>

            {/* TV Footer Progress Bar */}
            <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span>Displaying: <strong className="text-slate-200">{tvMode === 'leaderboard' ? 'Live Leaderboard' : `Sponsor: ${ads[currentAdIndex].title}`}</strong></span>
              </div>
              <div className="w-48 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full transition-all duration-1000 w-2/3"></div>
              </div>
              <span>{gym.name} • IronBoard Kiosk v1.0</span>
            </div>

          </div>
        )}

        {/* VIEW 3: GYM SETTINGS & CUSTOMIZATION */}
        {view === 'settings' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-500" /> Gym Customization & Branding
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym Name</label>
                <input 
                  type="text" 
                  value={gym.name}
                  onChange={(e) => setGym({ ...gym, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1 font-semibold">Gym Logo Image URL</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/logo.png"
                  value={gym.logo_url}
                  onChange={(e) => setGym({ ...gym, logo_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">Paste an image link for your gym logo to display on member headers and TV screens.</p>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-6">
              <h3 className="text-lg font-bold mb-4">Active Local Sponsors (Ad Rotation)</h3>
              <div className="space-y-3">
                {ads.map((ad, index) => (
                  <div key={ad.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200">{ad.title}</h4>
                      <p className="text-xs text-slate-400">{ad.description}</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Slot #{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <button 
              onClick={() => alert('Gym settings updated successfully!')}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl transition shadow-lg shadow-amber-500/20"
            >
              Save Gym Settings
            </button>
          </div>
        )}

      </main>

    </div>
  );
}
