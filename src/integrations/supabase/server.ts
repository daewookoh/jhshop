// Server-side Supabase client for metadata generation
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rmyeyouheztcvepjleah.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJteWV5b3VoZXp0Y3ZlcGpsZWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4NDY2MDgsImV4cCI6MjA3MzQyMjYwOH0.r90vuNGWhI1TMQ2CSTuRMU0ikQqywPlcG73dk2tg2b4";

// Server-side client (no localStorage)
export const supabaseServer = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
  },
});

