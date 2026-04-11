import { createClient } from '@supabase/supabase-js'

// This grabs the keys you just put in the private safe (.env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// This creates the "Bridge" using those keys
export const supabase = createClient(supabaseUrl, supabaseAnonKey)