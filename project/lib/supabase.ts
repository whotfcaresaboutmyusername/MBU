import './fetch-polyfill';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    // Use custom fetch implementation for React Native
    fetch: fetch.bind(globalThis),
  },
  global: {
    // Use native fetch from React Native
    fetch: fetch.bind(globalThis),
    headers: Headers,
  },
});
