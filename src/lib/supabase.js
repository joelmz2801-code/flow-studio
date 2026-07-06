import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'https://swamnrkwqacuvkpifqzb.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_EDMNiMpAT9aGehRyX4CM9A_yra7iUns'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isAuthEnabled = !!supabase
