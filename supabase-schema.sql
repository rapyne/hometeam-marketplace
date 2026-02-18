-- ============================================
-- HomeTeam Marketplace — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Practitioners Table
-- ============================================
CREATE TABLE IF NOT EXISTS practitioners (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    credentials TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT 'XX',
    color TEXT NOT NULL DEFAULT '#4b916d',
    bg_color TEXT NOT NULL DEFAULT '#eef7f0',
    location TEXT NOT NULL DEFAULT '',
    specialties TEXT[] NOT NULL DEFAULT '{}',
    approaches TEXT[] NOT NULL DEFAULT '{}',
    session_types TEXT[] NOT NULL DEFAULT '{}',
    bio TEXT NOT NULL DEFAULT '',
    offerings JSONB NOT NULL DEFAULT '[]',
    starting_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    rating NUMERIC(2,1) NOT NULL DEFAULT 5.0,
    review_count INTEGER NOT NULL DEFAULT 0,
    reviews JSONB NOT NULL DEFAULT '[]',
    featured BOOLEAN NOT NULL DEFAULT false,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_practitioners_featured ON practitioners(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_practitioners_specialties ON practitioners USING GIN(specialties);
CREATE INDEX IF NOT EXISTS idx_practitioners_rating ON practitioners(rating DESC);
CREATE INDEX IF NOT EXISTS idx_practitioners_price ON practitioners(starting_price);

-- ============================================
-- Auto-update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_practitioners_updated_at
    BEFORE UPDATE ON practitioners
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can view practitioners)
CREATE POLICY "Public can view practitioners"
    ON practitioners
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only authenticated users (admins) can insert
CREATE POLICY "Authenticated users can insert practitioners"
    ON practitioners
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Only authenticated users (admins) can update
CREATE POLICY "Authenticated users can update practitioners"
    ON practitioners
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Only authenticated users (admins) can delete
CREATE POLICY "Authenticated users can delete practitioners"
    ON practitioners
    FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- Seed Data (16 default practitioners)
-- ============================================
INSERT INTO practitioners (name, credentials, title, avatar, color, bg_color, location, specialties, approaches, session_types, bio, offerings, starting_price, rating, review_count, reviews, featured, verified) VALUES
(
    'Dr. Sarah Kim',
    'PsyD, Licensed Clinical Psychologist',
    'Clinical Psychologist',
    'SK', '#4b916d', '#eef7f0',
    'San Francisco, CA',
    ARRAY['Anxiety & Depression', 'LGBTQ+ Affirming', 'Trauma & PTSD'],
    ARRAY['CBT', 'EMDR', 'Humanistic'],
    ARRAY['In-Person', 'Virtual'],
    'Dr. Kim specializes in helping individuals navigate anxiety, depression, and trauma with a warm, evidence-based approach. She is committed to creating a safe, affirming space for clients of all backgrounds and identities.',
    '[{"name": "Individual Therapy (50 min)", "price": 175, "duration": "50 min"}, {"name": "Initial Consultation (30 min)", "price": 0, "duration": "30 min"}, {"name": "EMDR Session (80 min)", "price": 225, "duration": "80 min"}]'::jsonb,
    175, 4.9, 47,
    '[{"author": "Jamie L.", "stars": 5, "text": "Dr. Kim has been an incredible support. She creates such a comfortable environment and her EMDR work has been transformative."}, {"author": "Chris R.", "stars": 5, "text": "Highly recommend! Dr. Kim helped me understand and manage my anxiety in ways I never thought possible."}]'::jsonb,
    true, true
),
(
    'Marcus Johnson, LCSW',
    'LCSW, Certified Trauma Professional',
    'Licensed Clinical Social Worker',
    'MJ', '#2f5dff', '#e8edff',
    'Brooklyn, NY',
    ARRAY['Trauma & PTSD', 'BIPOC-Centered Care', 'Substance Abuse'],
    ARRAY['Somatic', 'Psychodynamic', 'CBT'],
    ARRAY['In-Person', 'Virtual'],
    'Marcus brings over 12 years of experience working with individuals who have experienced trauma, systemic oppression, and substance use challenges. His approach centers cultural identity as a strength in the healing process.',
    '[{"name": "Individual Therapy (50 min)", "price": 150, "duration": "50 min"}, {"name": "Group Therapy (90 min)", "price": 60, "duration": "90 min"}, {"name": "Free Consultation (20 min)", "price": 0, "duration": "20 min"}]'::jsonb,
    150, 4.8, 62,
    '[{"author": "Darnell T.", "stars": 5, "text": "Marcus understands the intersection of identity and mental health in a way I''ve never experienced with other therapists."}, {"author": "Keisha W.", "stars": 5, "text": "Life-changing work. Marcus helped me process trauma I''d been carrying for years."}]'::jsonb,
    true, true
),
(
    'Elena Rodriguez, LMFT',
    'LMFT, Certified Gottman Therapist',
    'Licensed Marriage & Family Therapist',
    'ER', '#ff8044', '#fff3ec',
    'Austin, TX',
    ARRAY['Couples Therapy', 'LGBTQ+ Affirming', 'Anxiety & Depression'],
    ARRAY['Humanistic', 'CBT', 'Art Therapy'],
    ARRAY['In-Person', 'Virtual'],
    'Elena specializes in helping couples and individuals build stronger connections and navigate life transitions. Her approach integrates Gottman method with creative therapeutic techniques to foster growth and understanding.',
    '[{"name": "Couples Session (75 min)", "price": 200, "duration": "75 min"}, {"name": "Individual Therapy (50 min)", "price": 160, "duration": "50 min"}, {"name": "Intensive Couples Retreat (3 hr)", "price": 500, "duration": "3 hours"}]'::jsonb,
    160, 4.9, 38,
    '[{"author": "Taylor & Morgan", "stars": 5, "text": "Elena saved our relationship. Her couples sessions gave us tools to communicate and understand each other deeply."}, {"author": "Priya S.", "stars": 5, "text": "Warm, insightful, and incredibly skilled. Elena helped me find my voice."}]'::jsonb,
    true, true
),
(
    'Dr. James Okafor',
    'PhD, Clinical Psychology',
    'Clinical Psychologist',
    'JO', '#7200f3', '#f3ecff',
    'Chicago, IL',
    ARRAY['BIPOC-Centered Care', 'Anxiety & Depression', 'Grief & Loss'],
    ARRAY['Psychodynamic', 'CBT', 'Humanistic'],
    ARRAY['In-Person', 'Virtual'],
    'Dr. Okafor brings a culturally responsive lens to therapy, helping clients explore the intersection of identity, family dynamics, and mental health. He specializes in grief work and helping individuals navigate complex emotions.',
    '[{"name": "Individual Therapy (50 min)", "price": 185, "duration": "50 min"}, {"name": "Grief Support Group (90 min)", "price": 45, "duration": "90 min"}, {"name": "Initial Assessment (60 min)", "price": 200, "duration": "60 min"}]'::jsonb,
    185, 4.7, 29,
    '[{"author": "Amara B.", "stars": 5, "text": "Dr. Okafor has a gift for making you feel seen and understood. His grief work is truly exceptional."}, {"author": "Michael K.", "stars": 4, "text": "Thoughtful, patient, and deeply skilled. Highly recommended for anyone exploring identity and loss."}]'::jsonb,
    false, true
),
(
    'Sage Nakamura, LPC',
    'LPC, Certified Mindfulness Teacher',
    'Licensed Professional Counselor',
    'SN', '#4b916d', '#eef7f0',
    'Portland, OR',
    ARRAY['Mindfulness & Meditation', 'Anxiety & Depression', 'LGBTQ+ Affirming'],
    ARRAY['Holistic', 'Somatic', 'Humanistic'],
    ARRAY['Virtual'],
    'Sage integrates mindfulness, somatic awareness, and nature-based practices into their therapeutic work. They are passionate about helping clients develop a deeper relationship with themselves and find grounding in the present moment.',
    '[{"name": "Individual Session (50 min)", "price": 130, "duration": "50 min"}, {"name": "Mindfulness Workshop (2 hr)", "price": 75, "duration": "2 hours"}, {"name": "Nature-Based Therapy (90 min)", "price": 175, "duration": "90 min"}]'::jsonb,
    130, 5.0, 24,
    '[{"author": "River D.", "stars": 5, "text": "Sage has completely transformed my relationship with anxiety. Their mindfulness approach is gentle yet powerful."}, {"author": "Ash P.", "stars": 5, "text": "I finally found a therapist who understands the whole picture. Sage is a true healer."}]'::jsonb,
    true, true
),
(
    'Dr. Lisa Chen-Williams',
    'MD, Board Certified Psychiatrist',
    'Psychiatrist',
    'LC', '#df3336', '#fdecea',
    'Seattle, WA',
    ARRAY['Anxiety & Depression', 'Eating Disorders', 'Child & Adolescent'],
    ARRAY['CBT', 'DBT', 'Psychodynamic'],
    ARRAY['In-Person', 'Virtual'],
    'Dr. Chen-Williams is a board-certified psychiatrist specializing in the treatment of anxiety disorders, eating disorders, and adolescent mental health. She takes an integrative approach combining medication management with therapeutic techniques.',
    '[{"name": "Psychiatric Evaluation (60 min)", "price": 250, "duration": "60 min"}, {"name": "Medication Management (30 min)", "price": 150, "duration": "30 min"}, {"name": "Therapy + Med Management (50 min)", "price": 225, "duration": "50 min"}]'::jsonb,
    150, 4.8, 53,
    '[{"author": "Sarah T.", "stars": 5, "text": "Dr. Chen-Williams is incredibly thorough and caring. She took time to understand my full picture before recommending treatment."}, {"author": "Parent of Client", "stars": 5, "text": "Our teenager has shown remarkable progress under Dr. Chen-Williams'' care. So grateful we found her."}]'::jsonb,
    false, true
),
(
    'Kai Thompson, LMHC',
    'LMHC, Certified Sex Therapist',
    'Licensed Mental Health Counselor',
    'KT', '#f9ad4d', '#fef6e8',
    'Miami, FL',
    ARRAY['LGBTQ+ Affirming', 'Couples Therapy', 'Anxiety & Depression'],
    ARRAY['Humanistic', 'Somatic', 'CBT'],
    ARRAY['In-Person', 'Virtual'],
    'Kai creates a warm, nonjudgmental space for exploring identity, relationships, and intimacy. Their work focuses on helping LGBTQ+ individuals and couples build authentic connections and embrace their full selves.',
    '[{"name": "Individual Session (50 min)", "price": 140, "duration": "50 min"}, {"name": "Couples Session (75 min)", "price": 190, "duration": "75 min"}, {"name": "Free Discovery Call (15 min)", "price": 0, "duration": "15 min"}]'::jsonb,
    140, 4.9, 41,
    '[{"author": "Devon M.", "stars": 5, "text": "Kai helped me embrace parts of myself I had been suppressing for years. Truly transformative therapy."}, {"author": "Sam & Alex", "stars": 5, "text": "Our couples sessions with Kai have strengthened our bond immensely. Can''t recommend enough."}]'::jsonb,
    true, true
),
(
    'Dr. Amira Hassan',
    'PsyD, Trauma Specialist',
    'Clinical Psychologist',
    'AH', '#0d4f3d', '#e8edff',
    'Dearborn, MI',
    ARRAY['Trauma & PTSD', 'BIPOC-Centered Care', 'Grief & Loss'],
    ARRAY['EMDR', 'Somatic', 'Psychodynamic'],
    ARRAY['In-Person', 'Virtual'],
    'Dr. Hassan specializes in trauma recovery with a culturally sensitive approach. She works with refugees, immigrants, and individuals from diverse backgrounds, understanding the unique challenges that come with navigating multiple cultural identities.',
    '[{"name": "Individual Therapy (50 min)", "price": 165, "duration": "50 min"}, {"name": "EMDR Intensive (2 hr)", "price": 350, "duration": "2 hours"}, {"name": "Consultation (30 min)", "price": 0, "duration": "30 min"}]'::jsonb,
    165, 4.9, 36,
    '[{"author": "Fatima R.", "stars": 5, "text": "Dr. Hassan understands cultural trauma in a way that few therapists do. She has been a lifeline for me."}, {"author": "Yusuf K.", "stars": 5, "text": "Patient, compassionate, and incredibly effective. Dr. Hassan''s EMDR work helped me process deep pain."}]'::jsonb,
    false, true
),
(
    'Jordan Blake, LCSW',
    'LCSW, Addiction Specialist',
    'Licensed Clinical Social Worker',
    'JB', '#4b916d', '#eef7f0',
    'Denver, CO',
    ARRAY['Substance Abuse', 'Trauma & PTSD', 'Mindfulness & Meditation'],
    ARRAY['DBT', 'Holistic', 'CBT'],
    ARRAY['In-Person', 'Virtual'],
    'Jordan combines evidence-based practices with holistic approaches to support individuals in addiction recovery and trauma healing. Their philosophy centers on meeting clients where they are and building resilience through compassion.',
    '[{"name": "Individual Session (50 min)", "price": 135, "duration": "50 min"}, {"name": "Recovery Group (90 min)", "price": 40, "duration": "90 min"}, {"name": "Intensive Outpatient (3 hr)", "price": 275, "duration": "3 hours"}]'::jsonb,
    135, 4.7, 28,
    '[{"author": "Chris M.", "stars": 5, "text": "Jordan helped me find a path to recovery that felt authentic to me. Their holistic approach was exactly what I needed."}, {"author": "Anonymous", "stars": 4, "text": "Supportive, understanding, and knowledgeable. I''ve made more progress in months than I did in years elsewhere."}]'::jsonb,
    false, true
),
(
    'Dr. Patricia Morales',
    'PhD, Child & Adolescent Psychologist',
    'Child & Adolescent Psychologist',
    'PM', '#ff8044', '#fff3ec',
    'Los Angeles, CA',
    ARRAY['Child & Adolescent', 'Anxiety & Depression', 'LGBTQ+ Affirming'],
    ARRAY['CBT', 'Art Therapy', 'Humanistic'],
    ARRAY['In-Person', 'Virtual'],
    'Dr. Morales specializes in working with children, adolescents, and their families. She uses creative therapeutic approaches including play therapy and art therapy to help young people express themselves and develop healthy coping strategies.',
    '[{"name": "Child/Teen Session (45 min)", "price": 160, "duration": "45 min"}, {"name": "Family Session (60 min)", "price": 200, "duration": "60 min"}, {"name": "Parent Consultation (30 min)", "price": 100, "duration": "30 min"}]'::jsonb,
    160, 4.8, 45,
    '[{"author": "Parent", "stars": 5, "text": "My daughter actually looks forward to her sessions with Dr. Morales. She has a gift for connecting with young people."}, {"author": "Parent", "stars": 5, "text": "Dr. Morales helped our family navigate a really difficult time. Her family sessions were incredible."}]'::jsonb,
    true, true
),
(
    'Rowan Blackwell, LPC',
    'LPC, EMDR Trained',
    'Licensed Professional Counselor',
    'RB', '#7200f3', '#f3ecff',
    'Nashville, TN',
    ARRAY['Trauma & PTSD', 'LGBTQ+ Affirming', 'Anxiety & Depression'],
    ARRAY['EMDR', 'Somatic', 'Humanistic'],
    ARRAY['Virtual'],
    'Rowan is a trauma-informed therapist who creates affirming spaces for LGBTQ+ individuals and anyone healing from trauma. They specialize in EMDR and somatic approaches, helping clients reconnect with their bodies and process difficult experiences.',
    '[{"name": "Individual Session (50 min)", "price": 125, "duration": "50 min"}, {"name": "EMDR Session (80 min)", "price": 180, "duration": "80 min"}, {"name": "Free Intro Call (15 min)", "price": 0, "duration": "15 min"}]'::jsonb,
    125, 5.0, 19,
    '[{"author": "Quinn J.", "stars": 5, "text": "Rowan is one of the most affirming and skilled therapists I''ve ever worked with. Highly recommend."}, {"author": "Taylor S.", "stars": 5, "text": "Finally found a therapist who truly gets it. Rowan''s virtual sessions feel just as connected as in-person."}]'::jsonb,
    false, true
),
(
    'Dr. David Park',
    'PsyD, Neuropsychologist',
    'Clinical Neuropsychologist',
    'DP', '#2f5dff', '#e8edff',
    'Boston, MA',
    ARRAY['Anxiety & Depression', 'Eating Disorders', 'Mindfulness & Meditation'],
    ARRAY['CBT', 'DBT', 'Holistic'],
    ARRAY['In-Person', 'Virtual'],
    'Dr. Park combines neuroscience with compassionate therapy to help clients understand the brain-mind connection. He specializes in anxiety, eating disorders, and integrating mindfulness practices into evidence-based treatment.',
    '[{"name": "Individual Therapy (50 min)", "price": 190, "duration": "50 min"}, {"name": "Neuropsych Assessment (3 hr)", "price": 600, "duration": "3 hours"}, {"name": "DBT Skills Group (90 min)", "price": 55, "duration": "90 min"}]'::jsonb,
    190, 4.6, 33,
    '[{"author": "Michelle T.", "stars": 5, "text": "Dr. Park helped me understand my brain and gave me concrete tools to manage my eating disorder."}, {"author": "Ryan H.", "stars": 4, "text": "Highly knowledgeable and compassionate. The neuropsych assessment was eye-opening."}]'::jsonb,
    false, true
),
(
    'Maya Patel, LMFT',
    'LMFT, Trauma-Informed Yoga Teacher',
    'Marriage & Family Therapist',
    'MP', '#f9ad4d', '#fef6e8',
    'Oakland, CA',
    ARRAY['Couples Therapy', 'Mindfulness & Meditation', 'BIPOC-Centered Care'],
    ARRAY['Somatic', 'Holistic', 'Humanistic'],
    ARRAY['In-Person', 'Virtual'],
    'Maya weaves together somatic therapy, mindfulness, and culturally responsive practices to support individuals and couples. Her work honors the wisdom of the body and the importance of cultural identity in the healing journey.',
    '[{"name": "Individual Session (50 min)", "price": 145, "duration": "50 min"}, {"name": "Couples Session (75 min)", "price": 195, "duration": "75 min"}, {"name": "Somatic Yoga Therapy (60 min)", "price": 120, "duration": "60 min"}]'::jsonb,
    120, 4.9, 31,
    '[{"author": "Anjali R.", "stars": 5, "text": "Maya''s approach is unlike anything I''ve experienced. The combination of talk therapy and somatic work has been transformative."}, {"author": "Couple Client", "stars": 5, "text": "Maya helped us reconnect on a deeper level. Her couples work is beautiful and effective."}]'::jsonb,
    false, true
),
(
    'Alex Rivera, LCSW',
    'LCSW, Bilingual (English/Spanish)',
    'Licensed Clinical Social Worker',
    'AR', '#df3336', '#fdecea',
    'Phoenix, AZ',
    ARRAY['Substance Abuse', 'BIPOC-Centered Care', 'Anxiety & Depression'],
    ARRAY['CBT', 'DBT', 'Holistic'],
    ARRAY['In-Person', 'Virtual'],
    'Alex provides bilingual therapy services (English & Spanish) with a focus on addiction recovery, anxiety, and culturally responsive care. They are passionate about breaking down barriers to mental health care in Latinx communities.',
    '[{"name": "Individual Session (50 min)", "price": 120, "duration": "50 min"}, {"name": "Group Therapy - Spanish (90 min)", "price": 35, "duration": "90 min"}, {"name": "Sliding Scale Session (50 min)", "price": 75, "duration": "50 min"}]'::jsonb,
    75, 4.8, 44,
    '[{"author": "Carlos G.", "stars": 5, "text": "Having therapy in Spanish with someone who understands my culture has made all the difference."}, {"author": "Maria L.", "stars": 5, "text": "Alex is compassionate and skilled. Their sliding scale made therapy accessible for my family."}]'::jsonb,
    false, true
),
(
    'Dr. Nkechi Okonkwo',
    'PhD, Licensed Psychologist',
    'Clinical Psychologist',
    'NO', '#4b916d', '#eef7f0',
    'Atlanta, GA',
    ARRAY['BIPOC-Centered Care', 'Trauma & PTSD', 'Grief & Loss'],
    ARRAY['Psychodynamic', 'EMDR', 'Humanistic'],
    ARRAY['In-Person', 'Virtual'],
    'Dr. Okonkwo specializes in intergenerational trauma, racial stress, and grief within Black and African diaspora communities. Her work is grounded in culturally affirming practices that honor ancestral wisdom alongside evidence-based methods.',
    '[{"name": "Individual Therapy (50 min)", "price": 175, "duration": "50 min"}, {"name": "Healing Circle (90 min)", "price": 50, "duration": "90 min"}, {"name": "EMDR Session (80 min)", "price": 220, "duration": "80 min"}]'::jsonb,
    175, 5.0, 27,
    '[{"author": "Blessing A.", "stars": 5, "text": "Dr. Okonkwo helped me understand generational patterns I''d been carrying. Her healing circles are powerful."}, {"author": "Tunde O.", "stars": 5, "text": "Exceptional therapist. Her understanding of cultural trauma is unmatched."}]'::jsonb,
    true, true
),
(
    'Sam Winters, LMHC',
    'LMHC, Play Therapist',
    'Licensed Mental Health Counselor',
    'SW', '#2f5dff', '#e8edff',
    'Minneapolis, MN',
    ARRAY['Child & Adolescent', 'LGBTQ+ Affirming', 'Anxiety & Depression'],
    ARRAY['Art Therapy', 'CBT', 'Humanistic'],
    ARRAY['In-Person'],
    'Sam specializes in working with children and teens using play therapy, art therapy, and creative expression. They create warm, playful environments where young people feel safe to explore their feelings and build resilience.',
    '[{"name": "Child Session (45 min)", "price": 140, "duration": "45 min"}, {"name": "Teen Session (50 min)", "price": 150, "duration": "50 min"}, {"name": "Family Play Therapy (60 min)", "price": 180, "duration": "60 min"}]'::jsonb,
    140, 4.9, 22,
    '[{"author": "Parent", "stars": 5, "text": "Sam has a magical way with kids. My son has blossomed since starting therapy."}, {"author": "Parent", "stars": 5, "text": "Creative, patient, and deeply caring. Sam is a wonderful therapist for children."}]'::jsonb,
    false, true
);
