import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ckjnrebfbhshmihysmjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNram5yZWJmYmhzaG1paHlzbWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjcwNzksImV4cCI6MjA4OTI0MzA3OX0.JwAp8CZVHlXgxa7oUZzTS9HJdctPgwZVtUlvWoKg934';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
