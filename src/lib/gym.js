import { supabase } from './supabase';

// Build a short, readable gym code from the gym name, e.g. REPS-4K2D.
export function makeGymCode(name) {
  const base = (name || 'GYM').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'GYM';
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${base}-${rand}`;
}

// Look a gym up by the code a member types or scans.
export async function getGymByCode(code) {
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return null;
  const { data, error } = await supabase
    .from('gyms')
    .select('*')
    .eq('code', clean)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// The URL a member opens (or scans from a QR code) to join a gym.
export function joinUrl(code) {
  return `${window.location.origin}/join?code=${encodeURIComponent(code)}`;
}

// The public display URL for a gym's wall monitor.
export function displayUrl(code) {
  return `${window.location.origin}/display/${encodeURIComponent(code)}`;
}
