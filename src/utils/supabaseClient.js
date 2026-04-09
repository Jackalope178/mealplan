import { createClient } from '@supabase/supabase-js';

// Replace these with your Supabase project credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lfobwzmmbddomkgftfky.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmb2J3em1tYmRkb21rZ2Z0Zmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NTg2MjMsImV4cCI6MjA5MTMzNDYyM30.vX8a_gb0ZtrGhsLEl2ozQRiBju6UD5b1LUdxCQdR6cE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
