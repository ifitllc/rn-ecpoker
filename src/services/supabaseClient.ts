import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const expoEnv = Constants.expoConfig?.extra ?? {};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || expoEnv.EXPO_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || expoEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(url, anonKey);
