import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const expoExtra = Constants.expoConfig?.extra ?? {};

// Prefer the build-time embedded config (always present), fall back to Metro-inlined env.
const url = expoExtra.EXPO_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const anonKey = expoExtra.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
export const hasSupabaseConfig = Boolean(url && anonKey);
