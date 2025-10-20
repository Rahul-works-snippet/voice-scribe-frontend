import { createClient } from '@supabase/supabase-js';

// Use environment variables in production, fallback to hardcoded for testing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vfuyhvsqpozorusepydo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmdXlodnNxcG96b3J1c2VweWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjM3NzgsImV4cCI6MjA3NTQ5OTc3OH0.Fj6nSs99eN2Of-JM-J0_CW1XNWzfRClc5v4W5a6dDpE
;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key missing!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
