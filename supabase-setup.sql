-- Run this SQL in Supabase SQL Editor
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run
-- Safe to run more than once.

-- One row per user: their profile, chosen program and all workout data
CREATE TABLE IF NOT EXISTS public.user_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    selected_program TEXT,
    workout_data JSONB DEFAULT '{}'::jsonb,
    profile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Older versions of this table were created before the profile column existed
ALTER TABLE public.user_data ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}'::jsonb;

-- Row Level Security: each user can only read and change their own row
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own data" ON public.user_data;
CREATE POLICY "Users can view own data"
    ON public.user_data FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own data" ON public.user_data;
CREATE POLICY "Users can insert own data"
    ON public.user_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own data" ON public.user_data;
CREATE POLICY "Users can update own data"
    ON public.user_data FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own data" ON public.user_data;
CREATE POLICY "Users can delete own data"
    ON public.user_data FOR DELETE
    USING (auth.uid() = user_id);

-- Logged-in users reach the table through the app; RLS above limits them to their own row
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_data TO authenticated;

-- (user_id is UNIQUE, which already gives it an index for fast lookups)

-- Make the API see the new table immediately
NOTIFY pgrst, 'reload schema';
