-- ============================================
-- HomeTeam Marketplace — Migration Script
-- Run this in Supabase SQL Editor on your EXISTING database
-- Safe to run multiple times (uses IF NOT EXISTS / DROP IF EXISTS)
-- ============================================

-- ============================================
-- 1. Add video_url column to practitioners
-- ============================================
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS video_url TEXT;

-- ============================================
-- 2. Clear existing reviews
-- ============================================
UPDATE practitioners SET reviews = '[]'::jsonb, review_count = 0;

-- ============================================
-- 3. Create practitioner_accounts table FIRST
--    (needed by bookings and conversations policies)
-- ============================================
CREATE TABLE IF NOT EXISTS practitioner_accounts (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    practitioner_id BIGINT REFERENCES practitioners(id),
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE practitioner_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts on re-run
DROP POLICY IF EXISTS "Practitioner can read own account" ON practitioner_accounts;
DROP POLICY IF EXISTS "Practitioner can insert own account" ON practitioner_accounts;
DROP POLICY IF EXISTS "Practitioner can update own account" ON practitioner_accounts;
DROP POLICY IF EXISTS "Admin can read all practitioner accounts" ON practitioner_accounts;

-- All authenticated users can read practitioner accounts (needed for messaging lookups)
CREATE POLICY "Practitioner can read own account"
    ON practitioner_accounts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Practitioner can insert own account"
    ON practitioner_accounts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Practitioner can update own account"
    ON practitioner_accounts FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 4. Create athlete_profiles table
-- ============================================
CREATE TABLE IF NOT EXISTS athlete_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE athlete_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes can read own profile" ON athlete_profiles;
DROP POLICY IF EXISTS "Athletes can insert own profile" ON athlete_profiles;
DROP POLICY IF EXISTS "Athletes can update own profile" ON athlete_profiles;
DROP POLICY IF EXISTS "Anyone can read athlete profiles" ON athlete_profiles;

-- Athletes can manage their own profile
CREATE POLICY "Athletes can read own profile"
    ON athlete_profiles FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Athletes can insert own profile"
    ON athlete_profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Athletes can update own profile"
    ON athlete_profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 5. Create athlete_favorites table
-- ============================================
CREATE TABLE IF NOT EXISTS athlete_favorites (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    athlete_id UUID REFERENCES athlete_profiles(id) ON DELETE CASCADE,
    practitioner_id BIGINT REFERENCES practitioners(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, practitioner_id)
);

ALTER TABLE athlete_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes can manage own favorites" ON athlete_favorites;

CREATE POLICY "Athletes can manage own favorites"
    ON athlete_favorites FOR ALL
    TO authenticated
    USING (auth.uid() = athlete_id)
    WITH CHECK (auth.uid() = athlete_id);

-- ============================================
-- 6. Create bookings table
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    athlete_id UUID REFERENCES athlete_profiles(id) ON DELETE CASCADE,
    practitioner_id BIGINT REFERENCES practitioners(id) ON DELETE CASCADE,
    offering_name TEXT,
    session_date DATE,
    session_time TEXT,
    status TEXT DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Athletes can read own bookings" ON bookings;
DROP POLICY IF EXISTS "Athletes can insert bookings" ON bookings;
DROP POLICY IF EXISTS "Practitioners can read their bookings" ON bookings;

CREATE POLICY "Athletes can read own bookings"
    ON bookings FOR SELECT
    TO authenticated
    USING (auth.uid() = athlete_id);

CREATE POLICY "Athletes can insert bookings"
    ON bookings FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "Practitioners can read their bookings"
    ON bookings FOR SELECT
    TO authenticated
    USING (practitioner_id IN (
        SELECT practitioner_id FROM practitioner_accounts WHERE id = auth.uid()
    ));

-- ============================================
-- 7. Create conversations table
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    athlete_id UUID REFERENCES athlete_profiles(id) ON DELETE CASCADE,
    practitioner_id BIGINT REFERENCES practitioners(id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(athlete_id, practitioner_id)
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access own conversations" ON conversations;

CREATE POLICY "Users can access own conversations"
    ON conversations FOR ALL
    TO authenticated
    USING (
        auth.uid() = athlete_id
        OR practitioner_id IN (
            SELECT practitioner_id FROM practitioner_accounts WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = athlete_id
        OR practitioner_id IN (
            SELECT practitioner_id FROM practitioner_accounts WHERE id = auth.uid()
        )
    );

-- ============================================
-- 8. Create messages table
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access messages in own conversations" ON messages;

CREATE POLICY "Users can access messages in own conversations"
    ON messages FOR ALL
    TO authenticated
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE
                athlete_id = auth.uid()
                OR practitioner_id IN (
                    SELECT practitioner_id FROM practitioner_accounts WHERE id = auth.uid()
                )
        )
    )
    WITH CHECK (
        sender_id = auth.uid()
        AND conversation_id IN (
            SELECT id FROM conversations WHERE
                athlete_id = auth.uid()
                OR practitioner_id IN (
                    SELECT practitioner_id FROM practitioner_accounts WHERE id = auth.uid()
                )
        )
    );

-- ============================================
-- 9. Performance indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_athlete_favorites_athlete ON athlete_favorites(athlete_id);
CREATE INDEX IF NOT EXISTS idx_bookings_athlete ON bookings(athlete_id);
CREATE INDEX IF NOT EXISTS idx_bookings_practitioner ON bookings(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_athlete ON conversations(athlete_id);
CREATE INDEX IF NOT EXISTS idx_conversations_practitioner ON conversations(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read) WHERE read = false;

-- ============================================
-- DONE! All tables, policies, and indexes created.
-- ============================================
