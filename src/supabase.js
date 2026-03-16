import { createClient } from '@supabase/supabase-js'

// These are safe to expose — RLS protects your data
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

// Check if Supabase is configured
export const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
