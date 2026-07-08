-- Flow Studio 数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本

-- ========================================
-- 1. 对话表
-- ========================================
CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '新对话',
  messages JSONB NOT NULL DEFAULT '[]',
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的对话"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能插入自己的对话"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的对话"
  ON public.chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的对话"
  ON public.chats FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);

-- ========================================
-- 2. API 预设表
-- ========================================
CREATE TABLE IF NOT EXISTS public.presets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '新预设',
  base_url TEXT NOT NULL DEFAULT '',
  api_key TEXT NOT NULL DEFAULT '',
  image_model TEXT NOT NULL DEFAULT '',
  video_model TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL DEFAULT '',
  video_path TEXT NOT NULL DEFAULT '',
  models JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的预设"
  ON public.presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能插入自己的预设"
  ON public.presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的预设"
  ON public.presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的预设"
  ON public.presets FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_presets_user_id ON public.presets(user_id);

-- ========================================
-- 3. 自定义提示词表
-- ========================================
CREATE TABLE IF NOT EXISTS public.custom_prompts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.custom_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的提示词"
  ON public.custom_prompts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能插入自己的提示词"
  ON public.custom_prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户只能更新自己的提示词"
  ON public.custom_prompts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "用户只能删除自己的提示词"
  ON public.custom_prompts FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_custom_prompts_user_id ON public.custom_prompts(user_id);

-- ========================================
-- 4. 开启实时订阅（可选，用于跨设备实时同步）
-- ========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.presets;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_prompts;
  EXCEPTION WHEN duplicate_object THEN
    -- 已经在 publication 中，忽略
    NULL;
  END;
END $$;
