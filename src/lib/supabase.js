import { createClient } from '@supabase/supabase-js'

// 从环境变量读取 Supabase 配置（vite 注入）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// 如果未配置，export 一个 null，调用方据此判断是否启用登录
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const isAuthEnabled = !!supabase
