-- ============================================
-- Practice Better Integration — Schema Migration
-- Run this in your Supabase SQL Editor after
-- the base schema has been applied
-- ============================================

-- ============================================
-- 1. Add PB fields to practitioners table
-- ============================================
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS pb_consultant_id TEXT;
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS pb_default_service_id TEXT;
ALTER TABLE practitioners ADD COLUMN IF NOT EXISTS pb_intake_form_id TEXT;

-- ============================================
-- 2. Availability Cache Table
-- Stores PB availability slots with a TTL
-- ============================================
CREATE TABLE IF NOT EXISTS pb_availability_cache (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    practitioner_id BIGINT REFERENCES practitioners(id) ON DELETE CASCADE,
    pb_consultant_id TEXT NOT NULL,
    pb_service_id TEXT NOT NULL,
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end TIMESTAMPTZ NOT NULL,
    slot_duration TEXT,
    cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(practitioner_id, slot_start, pb_service_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_avail_practitioner ON pb_availability_cache(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_pb_avail_slot_start ON pb_availability_cache(slot_start);
CREATE INDEX IF NOT EXISTS idx_pb_avail_cached ON pb_availability_cache(cached_at);

-- RLS for availability cache (public read, server-side write)
ALTER TABLE pb_availability_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view availability cache"
    ON pb_availability_cache
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Authenticated can manage availability cache"
    ON pb_availability_cache
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 3. PB Client Record Mapping Table
-- Links HomeTeam athletes to PB client records
-- ============================================
CREATE TABLE IF NOT EXISTS pb_client_map (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    athlete_id UUID NOT NULL,
    pb_record_id TEXT NOT NULL,
    pb_consultant_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(athlete_id, pb_consultant_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_client_map_athlete ON pb_client_map(athlete_id);

-- RLS for client map
ALTER TABLE pb_client_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view their own client map"
    ON pb_client_map
    FOR SELECT
    TO authenticated
    USING (athlete_id = auth.uid());

CREATE POLICY "Authenticated can insert client map"
    ON pb_client_map
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================
-- 4. Add PB fields to bookings table
-- ============================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pb_session_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pb_record_id TEXT;

-- ============================================
-- 5. Waitlist Table
-- Athletes can join a waitlist when no slots
-- ============================================
CREATE TABLE IF NOT EXISTS pb_waitlist (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    athlete_id UUID NOT NULL,
    practitioner_id BIGINT REFERENCES practitioners(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    UNIQUE(athlete_id, practitioner_id)
);

CREATE INDEX IF NOT EXISTS idx_pb_waitlist_practitioner ON pb_waitlist(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_pb_waitlist_athlete ON pb_waitlist(athlete_id);

-- RLS for waitlist
ALTER TABLE pb_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Athletes can view their own waitlist"
    ON pb_waitlist
    FOR SELECT
    TO authenticated
    USING (athlete_id = auth.uid());

CREATE POLICY "Athletes can join waitlist"
    ON pb_waitlist
    FOR INSERT
    TO authenticated
    WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "Athletes can leave waitlist"
    ON pb_waitlist
    FOR DELETE
    TO authenticated
    USING (athlete_id = auth.uid());

-- ============================================
-- 6. PB Services Cache Table
-- Stores synced services per practitioner
-- ============================================
CREATE TABLE IF NOT EXISTS pb_services (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    practitioner_id BIGINT REFERENCES practitioners(id) ON DELETE CASCADE,
    pb_service_id TEXT NOT NULL,
    name TEXT NOT NULL,
    duration INTEGER,
    service_type TEXT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(practitioner_id, pb_service_id)
);

ALTER TABLE pb_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view PB services"
    ON pb_services
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Authenticated can manage PB services"
    ON pb_services
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
