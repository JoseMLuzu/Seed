import { createClient } from '@supabase/supabase-js';
import { getAuthCallbackError, getAuthIntent } from './authFlow';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
const initialUrl = typeof window === 'undefined' ? '' : window.location.href;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
// Capture this before createClient can consume and clean a PKCE callback URL.
export const initialAuthIntent = getAuthIntent(initialUrl);
export const initialAuthCallbackError = getAuthCallbackError(initialUrl);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
      },
    })
  : null;
