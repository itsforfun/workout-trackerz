-- Run this SQL in Supabase SQL Editor
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste this → Run

-- Create user_data table
CREATE TABLE user_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    selected_program TEXT,
    workout_data JSONB DEFAULT '{}'::jsonb,
    profile JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own data
CREATE POLICY "Users can view own data"
    ON user_data
    FOR SELECT
    USING (auth.uid() = user_id);

-- Create policy: Users can insert their own data
CREATE POLICY "Users can insert own data"
    ON user_data
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own data
CREATE POLICY "Users can update own data"
    ON user_data
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Create policy: Users can delete their own data
CREATE POLICY "Users can delete own data"
    ON user_data
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX user_data_user_id_idx ON user_data(user_id);
