import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Trophy, Ticket } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { monthKey } from '../lib/admin';

// Monthly giveaway for one gym, shared by the admin console and the gym
// owner's console. One entry per member per day, only on days they logged
// a lift and only while the giveaway is switched on for that gym. The gym
// owner supplies the prize; the winner is shown on the gym's board.
export default function GiveawayPanel({ gym, user, onGymUpdated }) {
  const [entries, setEntries] = useState([]);
  const [winners, setWinners] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [prize, setPrize] = useState(gym?.giveaway_prize || '');
  const [saving, setSaving] = useState(false);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const month = monthKey();

  const load = useCallback(async () => {
    if (!gym) return;
    setLoading(true);
    const monthStart = `${month}-01`;
    const [{ data: ents }, { data: wins }] = await Promise.all([
      supabase.from('giveaway_entries').select('user_id, entry_date').eq('gym_id', gym.id).gte('entry_date', monthStart),
      supabase.from('giveaway_winners').select('*').eq('gym_id', gym.id).order('drawn_at', { ascending: false }).limit(12),
    ]);
    setEntries(ents || []);
    setWinners(wins || []);
    const ids = [...new Set([...(ents || []).map((e) => e.user_id), ...(wins || []).map((w) => w.user_id)])];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      const map = {};
      (profs || []).forEach((p) => { map[p.id] = p.display_name || 'Member'; });
      setNames(map);
    }
    setLoading(false);
  }, [gym, month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPrize(gym?.giveaway_prize || ''); }, [gym?.giveaway_prize]);

  if (!gym) return null;

  async function handleToggle(enabled) {
    setError('');
    setMessage('');
    const { error: err } = await supabase.from('gyms').update({ giveaway_enabled: enabled }).eq('id', gym.id);
    if (err) {
      setError('Could not change the giveaway setting. Try again.');
      return;
    }
    setMessage(enabled ? 'Giveaway is on — members earn an entry each day they log a lift.' : 'Giveaway is off.');
    onGymUpdated?.();
  }

  async function handleSavePrize(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    const { error: err } = await supabase.from('gyms').update({ giveaway_prize: prize.trim() || null }).eq('id', gym.id);
    setSaving(false);
    if (err) {
      setError('Could not save the prize. Try again.');
      return;
    }
    setMessage('Prize saved.');
    onGymUpdated?.();
  }

  async function handleDraw() {
    if (!confirmDraw) {
      setConfirmDraw(true);
      return;
    }
    setConfirmDraw(false);
    setDrawing(true);
    setError('');
    setMessage('');
    const entrants = [...new Set(entries.map((e) => e.user_id))];
    if (!entrants.length) {
      setError('No entries this month yet — nothing to draw.');
      setDrawing(false);
      return;
    }
    const winnerId = entrants[Math.floor(Math.random() * entrants.length)];
    const { error: err } = await supabase.from('giveaway_winners').insert({
      gym_id: gym.id,
      user_id: winnerId,
      prize: gym.giveaway_prize || null,
      month,
      drawn_by: user.id,
    });
    setDrawing(false);
    if (err) {
      setError('Could not record the draw. Try again.');
      return;
    }
    setMessage(`Winner drawn: ${names[winnerId] || 'a member'} — they will show on the gym board.`);
    await load();
  }

  const entrants = [...new Set(entries.map((e) => e.user_id))];

  return (
    <div className="space-y-6">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-400" /> Monthly giveaway — {month}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            1 entry per member per day, only on days they log a lift, only while switched on.
            The gym supplies the prize; the winner shows on the board.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-200 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={!!gym.giveaway_enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="w-5 h-5 accent-amber-500"
          />
          {gym.giveaway_enabled ? 'On' : 'Off'}
        </label>
      </div>

      <form onSubmit={handleSavePrize} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
        <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold">This month&apos;s prize (supplied by the gym)</label>
        <div className="flex gap-2">
          <input
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            placeholder="e.g. Free 1-month membership"
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
          />
          <button type="submit" disabled={saving} className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm disabled:opacity-50">
            {saving ? 'Saving…' : 'Save prize'}
          </button>
        </div>
        <p className="text-xs text-slate-500">While the giveaway is on, a giveaway ad runs on the gym board automatically.</p>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-emerald-400">{message}</p>}

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Ticket className="w-4 h-4 text-amber-400" /> Entries this month
        </h3>
        {loading ? (
          <p className="text-sm text-slate-400 mt-2">Loading entries…</p>
        ) : (
          <p className="text-sm text-slate-300 mt-2">
            <span className="text-2xl font-black text-amber-400">{entries.length}</span> entries from{' '}
            <span className="font-bold">{entrants.length}</span> member{entrants.length === 1 ? '' : 's'}
          </p>
        )}
        <button
          onClick={handleDraw}
          disabled={drawing || !entrants.length}
          className={`mt-4 px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-50 ${
            confirmDraw
              ? 'bg-red-500/20 text-red-300 border border-red-500/50'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
          }`}
        >
          {drawing ? 'Drawing…' : confirmDraw ? 'Tap again to draw a winner' : 'Draw this month’s winner'}
        </button>
        {!gym.giveaway_enabled && (
          <p className="text-xs text-slate-500 mt-2">The giveaway is currently off — entries stop until it is switched back on.</p>
        )}
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Past winners
        </h3>
        {winners.length === 0 ? (
          <p className="text-sm text-slate-400 mt-2">No draws yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {winners.map((w) => (
              <li key={w.id} className="text-sm text-slate-300 flex flex-wrap gap-x-2">
                <span className="font-bold text-slate-100">{names[w.user_id] || 'Member'}</span>
                <span className="text-slate-400">— {w.month}</span>
                {w.prize && <span className="text-slate-400">• {w.prize}</span>}
                <span className="text-slate-500 text-xs">{w.drawn_at?.split('T')[0]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
