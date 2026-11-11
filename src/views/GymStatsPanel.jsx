import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Dumbbell, Activity, Ticket, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { computeGymStats } from '../lib/stats';
import { monthKey } from '../lib/admin';

// Stats + member list for one gym, shared by the admin console and the
// gym owner's console. Aggregate numbers only — this is what an advertiser
// would ever see. Member names appear here because this screen is for the
// gym's owner and the admin, never for advertisers.
export default function GymStatsPanel({ gym }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!gym) return;
    setLoading(true);
    setError('');
    const monthStart = `${monthKey()}-01`;
    const [{ data: profiles }, { data: workouts }, { data: entries }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, username, created_at').eq('gym_id', gym.id),
      supabase.from('workouts').select('user_id, created_at').eq('gym_id', gym.id).order('created_at', { ascending: false }).limit(1000),
      supabase.from('giveaway_entries').select('user_id, entry_date').eq('gym_id', gym.id).gte('entry_date', monthStart),
    ]);
    if (!profiles || !workouts) {
      setError('Could not load stats — the new tables may not be set up yet (run migration 004 in Supabase).');
      setLoading(false);
      return;
    }
    setStats(computeGymStats(profiles, workouts, entries || []));
    setLoading(false);
  }, [gym]);

  useEffect(() => { load(); }, [load]);

  if (!gym) return null;
  if (loading) return <p className="text-slate-400 text-sm">Loading stats…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!stats) return null;

  const maxDay = Math.max(1, ...stats.daily.map((d) => d.count));
  const pitch = `${gym.name} — ${stats.totalMembers} members (${stats.activeMembers} active in the last 30 days), ${stats.totalLifts} lifts logged (${stats.liftsThisMonth} this month). The IronBoard leaderboard runs on the gym's TV screen, seen by members every visit.`;

  function copyPitch() {
    navigator.clipboard?.writeText(pitch).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const kpis = [
    { icon: Users, label: 'Members', value: stats.totalMembers },
    { icon: UserPlus, label: 'New this month', value: stats.newThisMonth },
    { icon: Dumbbell, label: 'Lifts logged', value: stats.totalLifts },
    { icon: Activity, label: 'Active (30 days)', value: stats.activeMembers },
    { icon: Ticket, label: 'Giveaway entries', value: `${stats.entriesThisMonth} (${stats.entrantsThisMonth} members)` },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider mb-1">
              <Icon className="w-4 h-4 text-amber-400" /> {label}
            </div>
            <p className="text-2xl font-black text-slate-100">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-200 mb-1">Lifts logged — last 14 days</h3>
        <p className="text-xs text-slate-500 mb-3">{stats.liftsThisMonth} lifts this month • {stats.totalLifts} all time</p>
        <div className="flex items-end gap-1.5 h-24">
          {stats.daily.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${d.label}: ${d.count} lifts`}>
              <span className="text-[10px] text-slate-400">{d.count || ''}</span>
              <div className="w-full rounded-t bg-amber-500/80" style={{ height: `${Math.max(d.count ? 6 : 2, (d.count / maxDay) * 64)}px` }} />
              <span className="text-[9px] text-slate-500 truncate w-full text-center">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Advertiser one-pager</h3>
            <p className="text-xs text-slate-400 mt-1">{pitch}</p>
            <p className="text-xs text-slate-500 mt-1">Aggregate numbers only — no member names or emails.</p>
          </div>
          <button onClick={copyPitch} className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 flex items-center gap-2">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <h3 className="text-sm font-bold text-slate-200 mb-3">Members ({stats.members.length})</h3>
        {stats.members.length === 0 ? (
          <p className="text-sm text-slate-400">No members joined yet.</p>
        ) : (
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
                <th className="py-2 pr-3 font-semibold">Member</th>
                <th className="py-2 pr-3 font-semibold">Joined</th>
                <th className="py-2 pr-3 font-semibold">Lifts</th>
                <th className="py-2 pr-3 font-semibold">Active days</th>
                <th className="py-2 pr-3 font-semibold">Entries</th>
                <th className="py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {stats.members.map((m) => (
                <tr key={m.id} className="border-b border-slate-800/60 last:border-0">
                  <td className="py-2 pr-3 font-medium text-slate-200">{m.name}</td>
                  <td className="py-2 pr-3 text-slate-400">{m.joinedAt ? m.joinedAt.split('T')[0] : '—'}</td>
                  <td className="py-2 pr-3 text-slate-200">{m.lifts}</td>
                  <td className="py-2 pr-3 text-slate-200">{m.activeDays}</td>
                  <td className="py-2 pr-3 text-slate-200">{m.entries}</td>
                  <td className="py-2">
                    {m.active
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Active</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">Inactive</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
