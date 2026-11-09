import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import AuthView from './views/AuthView';
import MemberView from './views/MemberView';
import OwnerView from './views/OwnerView';
import DisplayView from './views/DisplayView';

// IronBoard, split into two apps sharing one Supabase backend.
//   /                  member app (sign in, log lifts, gym feed)
//   /join?code=XXXX   member sign-up with a gym code filled in (QR links land here)
//   /owner            gym owner setup: create a gym, get its code + QR
//   /display/XXXX     public gym screen for the wall monitor (no sign-in)
function parseRoute() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const displayMatch = path.match(/^\/display\/([^/]+)\/?$/);
  if (displayMatch) return { view: 'display', code: decodeURIComponent(displayMatch[1]) };
  if (path === '/join') return { view: 'auth', code: params.get('code') || '' };
  if (path === '/owner') return { view: 'owner' };
  return { view: 'member' };
}

export default function App() {
  const [route] = useState(parseRoute);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    setLoading(true);
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    if (s?.user) {
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
      setProfile(prof || null);
      if (prof?.gym_id) {
        const { data: g } = await supabase.from('gyms').select('*').eq('id', prof.gym_id).maybeSingle();
        setGym(g || null);
      } else {
        setGym(null);
      }
    } else {
      setProfile(null);
      setGym(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => loadSession());
    return () => subscription.unsubscribe();
  }, [loadSession]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setGym(null);
  }

  if (route.view === 'display') {
    return <DisplayView code={route.code} />;
  }

  if (route.view === 'owner') {
    if (loading) return <LoadingScreen />;
    if (!session) return <AuthView onDone={loadSession} />;
    return <OwnerView user={session.user} />;
  }

  // Member app (and /join).
  if (loading) return <LoadingScreen />;
  if (!session) return <AuthView initialCode={route.code || ''} onDone={loadSession} />;
  if (!profile) return <AuthView initialCode={route.code || ''} initialMode="profile" onDone={loadSession} />;
  if (!gym) return <AuthView initialCode={route.code || ''} initialMode="profile" onDone={loadSession} />;
  return <MemberView user={session.user} profile={profile} gym={gym} onSignOut={handleSignOut} />;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans">
      <p className="text-slate-400">Loading IronBoard…</p>
    </div>
  );
}
