/* ============================================
   HomeTeam — Mental Health Marketplace
   Application Logic (Supabase Backend)
   ============================================ */

// ============================================
// Security: HTML Sanitization Utility
// ============================================
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// YouTube Video Helper
// ============================================
function extractYouTubeId(url) {
    if (!url || typeof url !== 'string') return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// ============================================
// Supabase Configuration
// ============================================
// IMPORTANT: Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://qfxjnnpxldurjhkbqelc.supabase.co/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeGpubnB4bGR1cmpoa2JxZWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNTQxNTQsImV4cCI6MjA4NjkzMDE1NH0.xE2ZKPFmq6Ue9hMFqRJnRDXDvJ8dTlpBrXIUSlOSr2M';

let supabaseClient = null;
let isSupabaseConnected = false;

function initSupabase() {
    try {
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            // Test connection only if real credentials are provided
            if (SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
                isSupabaseConnected = true;
                console.log('Supabase client initialized successfully');
            } else {
                console.warn('Supabase credentials not configured. Running in local/demo mode with localStorage fallback.');
                isSupabaseConnected = false;
            }
        } else {
            console.warn('Supabase library not loaded. Running in local mode.');
            isSupabaseConnected = false;
        }
    } catch (e) {
        console.error('Failed to initialize Supabase:', e);
        isSupabaseConnected = false;
    }
}

// ============================================
// Default Categories Data
// ============================================
const DEFAULT_CATEGORIES = [
    { id: 1, name: "Anxiety & Depression", icon: "😌" },
    { id: 2, name: "Trauma & PTSD", icon: "🌿" },
    { id: 3, name: "LGBTQ+ Affirming", icon: "🌈" },
    { id: 4, name: "Couples Therapy", icon: "💑" },
    { id: 5, name: "Substance Abuse", icon: "🔄" },
    { id: 6, name: "Child & Adolescent", icon: "🧒" },
    { id: 7, name: "Mindfulness & Meditation", icon: "🧘" },
    { id: 8, name: "BIPOC-Centered Care", icon: "✊" },
    { id: 9, name: "Grief & Loss", icon: "🕊️" },
    { id: 10, name: "Eating Disorders", icon: "🍃" }
];

let categories = [];
const CATEGORIES_STORAGE_KEY = 'hometeamgo_categories';

function loadCategories() {
    try {
        const stored = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (stored) {
            categories = JSON.parse(stored);
            return;
        }
    } catch (e) {
        console.warn('Failed to load categories from localStorage:', e);
    }
    categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
}

function saveCategories() {
    try {
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (e) {
        console.warn('Failed to save categories to localStorage:', e);
    }
}

function getNextCategoryId() {
    if (categories.length === 0) return 1;
    return Math.max(...categories.map(c => c.id)) + 1;
}

function getCategoryPractitionerCount(categoryName) {
    return practitioners.filter(p => (p.specialties || []).includes(categoryName)).length;
}

function addNewCategory(name, icon) {
    const newCat = { id: getNextCategoryId(), name: name.trim(), icon: icon || "📋" };
    categories.push(newCat);
    saveCategories();
    renderAllCategories();
    renderCategoryManager();
    showToast(`Category "${newCat.name}" added!`, 'success');
}

function editExistingCategory(id, name, icon) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const oldName = cat.name;
    cat.name = name.trim();
    cat.icon = icon || cat.icon;
    saveCategories();
    // Update practitioners that use the old name
    if (oldName !== cat.name) {
        practitioners.forEach(p => {
            const idx = (p.specialties || []).indexOf(oldName);
            if (idx !== -1) {
                p.specialties[idx] = cat.name;
            }
        });
        saveToLocalStorage();
    }
    renderAllCategories();
    renderCategoryManager();
    showToast(`Category updated!`, 'success');
}

function deleteExistingCategory(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const count = getCategoryPractitionerCount(cat.name);
    if (count > 0) {
        showToast(`Cannot delete "${cat.name}" — ${count} practitioner(s) use this category. Remove it from all practitioners first.`, 'error');
        return;
    }
    categories = categories.filter(c => c.id !== id);
    saveCategories();
    renderAllCategories();
    renderCategoryManager();
    showToast(`Category "${cat.name}" deleted.`, 'info');
}

function moveCategoryUp(id) {
    const idx = categories.findIndex(c => c.id === id);
    if (idx <= 0) return;
    [categories[idx - 1], categories[idx]] = [categories[idx], categories[idx - 1]];
    saveCategories();
    renderAllCategories();
    renderCategoryManager();
}

function moveCategoryDown(id) {
    const idx = categories.findIndex(c => c.id === id);
    if (idx < 0 || idx >= categories.length - 1) return;
    [categories[idx], categories[idx + 1]] = [categories[idx + 1], categories[idx]];
    saveCategories();
    renderAllCategories();
    renderCategoryManager();
}

let editingCategoryId = null;

function openCategoryModal(id) {
    editingCategoryId = id || null;
    const titleEl = document.getElementById('categoryModalTitle');
    const nameInput = document.getElementById('categoryNameInput');
    const iconInput = document.getElementById('categoryIconInput');

    if (editingCategoryId) {
        const cat = categories.find(c => c.id === editingCategoryId);
        if (!cat) return;
        titleEl.textContent = 'Edit Category';
        nameInput.value = cat.name;
        iconInput.value = cat.icon;
    } else {
        titleEl.textContent = 'Add Category';
        nameInput.value = '';
        iconInput.value = '';
    }
    openModal('categoryFormModal');
}

function saveCategoryForm(e) {
    e.preventDefault();
    const name = document.getElementById('categoryNameInput').value.trim();
    const icon = document.getElementById('categoryIconInput').value.trim();

    if (!name) {
        showToast('Please enter a category name.', 'error');
        return;
    }

    // Check for duplicate name (excluding current if editing)
    const duplicate = categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCategoryId);
    if (duplicate) {
        showToast(`A category named "${name}" already exists.`, 'error');
        return;
    }

    if (editingCategoryId) {
        editExistingCategory(editingCategoryId, name, icon);
    } else {
        addNewCategory(name, icon);
    }

    closeModal('categoryFormModal');
}

// ============================================
// Dynamic Category Rendering (all locations)
// ============================================
function renderHomepageCategories() {
    const grid = document.getElementById('categoriesGrid');
    if (!grid) return;
    grid.innerHTML = categories.map(cat => {
        const count = getCategoryPractitionerCount(cat.name);
        return `
            <div class="category-card" onclick="filterByCategory('${escapeHTML(cat.name).replace(/'/g, "\\'")}')">
                <div class="category-card__icon">${escapeHTML(cat.icon)}</div>
                <h3>${escapeHTML(cat.name)}</h3>
                <p>${count} practitioner${count !== 1 ? 's' : ''}</p>
            </div>
        `;
    }).join('');
}

function renderSpecialtyFilters() {
    const container = document.getElementById('specialtyFilters');
    if (!container) return;
    container.innerHTML = categories.map(cat => `
        <label class="filter-check"><input type="checkbox" value="${escapeHTML(cat.name)}" onchange="applyFilters()"><span>${escapeHTML(cat.name)}</span></label>
    `).join('');
}

function renderAdminSpecialtyFilter() {
    const select = document.getElementById('adminFilterSpecialty');
    if (!select) return;
    select.innerHTML = '<option value="">All Specialties</option>' +
        categories.map(cat => `<option value="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</option>`).join('');
}

function renderAdminFormSpecialties() {
    const container = document.getElementById('adminFormSpecialties');
    if (!container) return;
    container.innerHTML = categories.map(cat => `
        <label class="filter-check"><input type="checkbox" value="${escapeHTML(cat.name)}"><span>${escapeHTML(cat.name)}</span></label>
    `).join('');
}

function renderFooterCategories() {
    const container = document.getElementById('footerCategories');
    if (!container) return;
    // Show first 4 categories in footer
    container.innerHTML = categories.slice(0, 4).map(cat => `
        <a href="#" onclick="filterByCategory('${escapeHTML(cat.name).replace(/'/g, "\\'")}')">${escapeHTML(cat.name)}</a>
    `).join('');
}

function renderSportFilters() {
    const container = document.getElementById('sportFilters');
    if (!container) return;
    // Collect all unique sports from practitioners
    const allSports = new Set();
    practitioners.forEach(p => {
        (p.sports || []).forEach(s => allSports.add(s));
    });
    const sorted = Array.from(allSports).sort();
    container.innerHTML = sorted.map(sport => `
        <label class="filter-check"><input type="checkbox" value="${escapeHTML(sport)}" onchange="applyFilters()"><span>${escapeHTML(sport)}</span></label>
    `).join('');
}

function renderAllCategories() {
    renderHomepageCategories();
    renderSpecialtyFilters();
    renderSportFilters();
    renderAdminSpecialtyFilter();
    renderAdminFormSpecialties();
    renderFooterCategories();
}

// ============================================
// Category Manager (Admin)
// ============================================
function renderCategoryManager() {
    const tbody = document.getElementById('categoryManagerBody');
    if (!tbody) return;

    if (categories.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 32px; color: var(--text-muted);">No categories yet. Add one to get started.</td></tr>`;
        return;
    }

    tbody.innerHTML = categories.map((cat, idx) => {
        const count = getCategoryPractitionerCount(cat.name);
        return `
            <tr>
                <td>
                    <span style="font-size: 24px;">${escapeHTML(cat.icon)}</span>
                </td>
                <td>
                    <strong>${escapeHTML(cat.name)}</strong>
                </td>
                <td>${count}</td>
                <td>
                    <div class="category-order-btns">
                        <button class="btn btn--outline btn--xs" onclick="moveCategoryUp(${cat.id})" ${idx === 0 ? 'disabled' : ''} title="Move up">&#9650;</button>
                        <button class="btn btn--outline btn--xs" onclick="moveCategoryDown(${cat.id})" ${idx === categories.length - 1 ? 'disabled' : ''} title="Move down">&#9660;</button>
                    </div>
                </td>
                <td>
                    <div class="admin-actions">
                        <button class="btn btn--outline btn--sm" onclick="openCategoryModal(${cat.id})">Edit</button>
                        <button class="btn btn--danger btn--sm" onclick="deleteExistingCategory(${cat.id})">Delete</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// Default Practitioner Data (fallback/seed)
// ============================================
const DEFAULT_PRACTITIONERS = [
    {
        id: 1,
        name: "Dr. Sarah Kim",
        credentials: "PsyD, Licensed Clinical Psychologist",
        title: "Clinical Psychologist",
        avatar: "SK",
        color: "#4b916d",
        bgColor: "#eef7f0",
        location: "San Francisco, CA",
        specialties: ["Anxiety & Depression", "LGBTQ+ Affirming", "Trauma & PTSD"],
        approaches: ["CBT", "EMDR", "Humanistic"],
        sports: ["Basketball", "Soccer", "Track & Field"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Kim specializes in helping individuals navigate anxiety, depression, and trauma with a warm, evidence-based approach. She is committed to creating a safe, affirming space for clients of all backgrounds and identities.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 175, duration: "50 min" },
            { name: "Initial Consultation (30 min)", price: 0, duration: "30 min" },
            { name: "EMDR Session (80 min)", price: 225, duration: "80 min" }
        ],
        startingPrice: 175,
        videoUrl: '',
        featured: true,
        verified: true
    },
    {
        id: 2,
        name: "Marcus Johnson, LCSW",
        credentials: "LCSW, Certified Trauma Professional",
        title: "Licensed Clinical Social Worker",
        avatar: "MJ",
        color: "#2f5dff",
        bgColor: "#e8edff",
        location: "Brooklyn, NY",
        specialties: ["Trauma & PTSD", "BIPOC-Centered Care", "Substance Abuse"],
        approaches: ["Somatic", "Psychodynamic", "CBT"],
        sports: ["Football", "Basketball", "Boxing"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Marcus brings over 12 years of experience working with individuals who have experienced trauma, systemic oppression, and substance use challenges. His approach centers cultural identity as a strength in the healing process.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 150, duration: "50 min" },
            { name: "Group Therapy (90 min)", price: 60, duration: "90 min" },
            { name: "Free Consultation (20 min)", price: 0, duration: "20 min" }
        ],
        startingPrice: 150,
        videoUrl: '',
        featured: true,
        verified: true
    },
    {
        id: 3,
        name: "Elena Rodriguez, LMFT",
        credentials: "LMFT, Certified Gottman Therapist",
        title: "Licensed Marriage & Family Therapist",
        avatar: "ER",
        color: "#ff8044",
        bgColor: "#fff3ec",
        location: "Austin, TX",
        specialties: ["Couples Therapy", "LGBTQ+ Affirming", "Anxiety & Depression"],
        approaches: ["Humanistic", "CBT", "Art Therapy"],
        sports: ["Tennis", "Golf", "Swimming"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Elena specializes in helping couples and individuals build stronger connections and navigate life transitions. Her approach integrates Gottman method with creative therapeutic techniques to foster growth and understanding.",
        offerings: [
            { name: "Couples Session (75 min)", price: 200, duration: "75 min" },
            { name: "Individual Therapy (50 min)", price: 160, duration: "50 min" },
            { name: "Intensive Couples Retreat (3 hr)", price: 500, duration: "3 hours" }
        ],
        startingPrice: 160,
        videoUrl: '',
        featured: true,
        verified: true
    },
    {
        id: 4,
        name: "Dr. James Okafor",
        credentials: "PhD, Clinical Psychology",
        title: "Clinical Psychologist",
        avatar: "JO",
        color: "#7200f3",
        bgColor: "#f3ecff",
        location: "Chicago, IL",
        specialties: ["BIPOC-Centered Care", "Anxiety & Depression", "Grief & Loss"],
        approaches: ["Psychodynamic", "CBT", "Humanistic"],
        sports: ["Football", "Track & Field", "Baseball"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Okafor brings a culturally responsive lens to therapy, helping clients explore the intersection of identity, family dynamics, and mental health. He specializes in grief work and helping individuals navigate complex emotions.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 185, duration: "50 min" },
            { name: "Grief Support Group (90 min)", price: 45, duration: "90 min" },
            { name: "Initial Assessment (60 min)", price: 200, duration: "60 min" }
        ],
        startingPrice: 185,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 5,
        name: "Sage Nakamura, LPC",
        credentials: "LPC, Certified Mindfulness Teacher",
        title: "Licensed Professional Counselor",
        avatar: "SN",
        color: "#4b916d",
        bgColor: "#eef7f0",
        location: "Portland, OR",
        specialties: ["Mindfulness & Meditation", "Anxiety & Depression", "LGBTQ+ Affirming"],
        approaches: ["Holistic", "Somatic", "Humanistic"],
        sports: ["Yoga", "Running", "Cycling"],
        sessionTypes: ["Virtual"],
        bio: "Sage integrates mindfulness, somatic awareness, and nature-based practices into their therapeutic work. They are passionate about helping clients develop a deeper relationship with themselves and find grounding in the present moment.",
        offerings: [
            { name: "Individual Session (50 min)", price: 130, duration: "50 min" },
            { name: "Mindfulness Workshop (2 hr)", price: 75, duration: "2 hours" },
            { name: "Nature-Based Therapy (90 min)", price: 175, duration: "90 min" }
        ],
        startingPrice: 130,
        videoUrl: '',
        featured: true,
        verified: true
    },
    {
        id: 6,
        name: "Dr. Lisa Chen-Williams",
        credentials: "MD, Board Certified Psychiatrist",
        title: "Psychiatrist",
        avatar: "LC",
        color: "#df3336",
        bgColor: "#fdecea",
        location: "Seattle, WA",
        specialties: ["Anxiety & Depression", "Eating Disorders", "Child & Adolescent"],
        approaches: ["CBT", "DBT", "Psychodynamic"],
        sports: ["Gymnastics", "Figure Skating", "Swimming"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Chen-Williams is a board-certified psychiatrist specializing in the treatment of anxiety disorders, eating disorders, and adolescent mental health. She takes an integrative approach combining medication management with therapeutic techniques.",
        offerings: [
            { name: "Psychiatric Evaluation (60 min)", price: 250, duration: "60 min" },
            { name: "Medication Management (30 min)", price: 150, duration: "30 min" },
            { name: "Therapy + Med Management (50 min)", price: 225, duration: "50 min" }
        ],
        startingPrice: 150,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 7,
        name: "Kai Thompson, LMHC",
        credentials: "LMHC, Certified Sex Therapist",
        title: "Licensed Mental Health Counselor",
        avatar: "KT",
        color: "#f9ad4d",
        bgColor: "#fef6e8",
        location: "Miami, FL",
        specialties: ["LGBTQ+ Affirming", "Couples Therapy", "Anxiety & Depression"],
        approaches: ["Humanistic", "Somatic", "CBT"],
        sports: ["Soccer", "Volleyball", "Tennis"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Kai creates a warm, nonjudgmental space for exploring identity, relationships, and intimacy. Their work focuses on helping LGBTQ+ individuals and couples build authentic connections and embrace their full selves.",
        offerings: [
            { name: "Individual Session (50 min)", price: 140, duration: "50 min" },
            { name: "Couples Session (75 min)", price: 190, duration: "75 min" },
            { name: "Free Discovery Call (15 min)", price: 0, duration: "15 min" }
        ],
        startingPrice: 140,
        videoUrl: '',
        featured: true,
        verified: true
    },
    {
        id: 8,
        name: "Dr. Amira Hassan",
        credentials: "PsyD, Trauma Specialist",
        title: "Clinical Psychologist",
        avatar: "AH",
        color: "#0d4f3d",
        bgColor: "#e8edff",
        location: "Dearborn, MI",
        specialties: ["Trauma & PTSD", "BIPOC-Centered Care", "Grief & Loss"],
        approaches: ["EMDR", "Somatic", "Psychodynamic"],
        sports: ["Wrestling", "MMA", "Boxing"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Hassan specializes in trauma recovery with a culturally sensitive approach. She works with refugees, immigrants, and individuals from diverse backgrounds, understanding the unique challenges that come with navigating multiple cultural identities.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 165, duration: "50 min" },
            { name: "EMDR Intensive (2 hr)", price: 350, duration: "2 hours" },
            { name: "Consultation (30 min)", price: 0, duration: "30 min" }
        ],
        startingPrice: 165,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 9,
        name: "Jordan Blake, LCSW",
        credentials: "LCSW, Addiction Specialist",
        title: "Licensed Clinical Social Worker",
        avatar: "JB",
        color: "#4b916d",
        bgColor: "#eef7f0",
        location: "Denver, CO",
        specialties: ["Substance Abuse", "Trauma & PTSD", "Mindfulness & Meditation"],
        approaches: ["DBT", "Holistic", "CBT"],
        sports: ["Skiing", "Snowboarding", "Rock Climbing"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Jordan combines evidence-based practices with holistic approaches to support individuals in addiction recovery and trauma healing. Their philosophy centers on meeting clients where they are and building resilience through compassion.",
        offerings: [
            { name: "Individual Session (50 min)", price: 135, duration: "50 min" },
            { name: "Recovery Group (90 min)", price: 40, duration: "90 min" },
            { name: "Intensive Outpatient (3 hr)", price: 275, duration: "3 hours" }
        ],
        startingPrice: 135,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 10,
        name: "Dr. Patricia Morales",
        credentials: "PhD, Child & Adolescent Psychologist",
        title: "Child & Adolescent Psychologist",
        avatar: "PM",
        color: "#ff8044",
        bgColor: "#fff3ec",
        location: "Los Angeles, CA",
        specialties: ["Child & Adolescent", "Anxiety & Depression", "LGBTQ+ Affirming"],
        approaches: ["CBT", "Art Therapy", "Humanistic"],
        sports: ["Soccer", "Basketball", "Gymnastics"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Morales specializes in working with children, adolescents, and their families. She uses creative therapeutic approaches including play therapy and art therapy to help young people express themselves and develop healthy coping strategies.",
        offerings: [
            { name: "Child/Teen Session (45 min)", price: 160, duration: "45 min" },
            { name: "Family Session (60 min)", price: 200, duration: "60 min" },
            { name: "Parent Consultation (30 min)", price: 100, duration: "30 min" }
        ],
        startingPrice: 160,
        videoUrl: '',
        featured: true,
        verified: true
    },
    {
        id: 11,
        name: "Rowan Blackwell, LPC",
        credentials: "LPC, EMDR Trained",
        title: "Licensed Professional Counselor",
        avatar: "RB",
        color: "#7200f3",
        bgColor: "#f3ecff",
        location: "Nashville, TN",
        specialties: ["Trauma & PTSD", "LGBTQ+ Affirming", "Anxiety & Depression"],
        approaches: ["EMDR", "Somatic", "Humanistic"],
        sports: ["Running", "CrossFit", "Rowing"],
        sessionTypes: ["Virtual"],
        bio: "Rowan is a trauma-informed therapist who creates affirming spaces for LGBTQ+ individuals and anyone healing from trauma. They specialize in EMDR and somatic approaches, helping clients reconnect with their bodies and process difficult experiences.",
        offerings: [
            { name: "Individual Session (50 min)", price: 125, duration: "50 min" },
            { name: "EMDR Session (80 min)", price: 180, duration: "80 min" },
            { name: "Free Intro Call (15 min)", price: 0, duration: "15 min" }
        ],
        startingPrice: 125,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 12,
        name: "Dr. David Park",
        credentials: "PsyD, Neuropsychologist",
        title: "Clinical Neuropsychologist",
        avatar: "DP",
        color: "#2f5dff",
        bgColor: "#e8edff",
        location: "Boston, MA",
        specialties: ["Anxiety & Depression", "Eating Disorders", "Mindfulness & Meditation"],
        approaches: ["CBT", "DBT", "Holistic"],
        sports: ["Hockey", "Lacrosse", "Football"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Park combines neuroscience with compassionate therapy to help clients understand the brain-mind connection. He specializes in anxiety, eating disorders, and integrating mindfulness practices into evidence-based treatment.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 190, duration: "50 min" },
            { name: "Neuropsych Assessment (3 hr)", price: 600, duration: "3 hours" },
            { name: "DBT Skills Group (90 min)", price: 55, duration: "90 min" }
        ],
        startingPrice: 190,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 13,
        name: "Maya Patel, LMFT",
        credentials: "LMFT, Trauma-Informed Yoga Teacher",
        title: "Marriage & Family Therapist",
        avatar: "MP",
        color: "#f9ad4d",
        bgColor: "#fef6e8",
        location: "Oakland, CA",
        specialties: ["Couples Therapy", "Mindfulness & Meditation", "BIPOC-Centered Care"],
        approaches: ["Somatic", "Holistic", "Humanistic"],
        sports: ["Yoga", "Dance", "Martial Arts"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Maya weaves together somatic therapy, mindfulness, and culturally responsive practices to support individuals and couples. Her work honors the wisdom of the body and the importance of cultural identity in the healing journey.",
        offerings: [
            { name: "Individual Session (50 min)", price: 145, duration: "50 min" },
            { name: "Couples Session (75 min)", price: 195, duration: "75 min" },
            { name: "Somatic Yoga Therapy (60 min)", price: 120, duration: "60 min" }
        ],
        startingPrice: 120,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 14,
        name: "Alex Rivera, LCSW",
        credentials: "LCSW, Bilingual (English/Spanish)",
        title: "Licensed Clinical Social Worker",
        avatar: "AR",
        color: "#df3336",
        bgColor: "#fdecea",
        location: "Phoenix, AZ",
        specialties: ["Substance Abuse", "BIPOC-Centered Care", "Anxiety & Depression"],
        approaches: ["CBT", "DBT", "Holistic"],
        sports: ["Soccer", "Baseball", "Boxing"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Alex provides bilingual therapy services (English & Spanish) with a focus on addiction recovery, anxiety, and culturally responsive care. They are passionate about breaking down barriers to mental health care in Latinx communities.",
        offerings: [
            { name: "Individual Session (50 min)", price: 120, duration: "50 min" },
            { name: "Group Therapy - Spanish (90 min)", price: 35, duration: "90 min" },
            { name: "Sliding Scale Session (50 min)", price: 75, duration: "50 min" }
        ],
        startingPrice: 75,
        videoUrl: '',
        featured: false,
        verified: true
    },
    {
        id: 15,
        name: "Dr. Nkechi Okonkwo",
        credentials: "PhD, Licensed Psychologist",
        title: "Clinical Psychologist",
        avatar: "NO",
        color: "#4b916d",
        bgColor: "#eef7f0",
        location: "Atlanta, GA",
        specialties: ["BIPOC-Centered Care", "Trauma & PTSD", "Grief & Loss"],
        approaches: ["Psychodynamic", "EMDR", "Humanistic"],
        sports: ["Track & Field", "Basketball", "Tennis"],
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Okonkwo specializes in intergenerational trauma, racial stress, and grief within Black and African diaspora communities. Her work is grounded in culturally affirming practices that honor ancestral wisdom alongside evidence-based methods.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 175, duration: "50 min" },
            { name: "Healing Circle (90 min)", price: 50, duration: "90 min" },
            { name: "EMDR Session (80 min)", price: 220, duration: "80 min" }
        ],
        startingPrice: 175,
        videoUrl: '',
        featured: true,
        verified: true
    },
    {
        id: 16,
        name: "Sam Winters, LMHC",
        credentials: "LMHC, Play Therapist",
        title: "Licensed Mental Health Counselor",
        avatar: "SW",
        color: "#2f5dff",
        bgColor: "#e8edff",
        location: "Minneapolis, MN",
        specialties: ["Child & Adolescent", "LGBTQ+ Affirming", "Anxiety & Depression"],
        approaches: ["Art Therapy", "CBT", "Humanistic"],
        sports: ["Swimming", "Soccer", "Basketball"],
        sessionTypes: ["In-Person"],
        bio: "Sam specializes in working with children and teens using play therapy, art therapy, and creative expression. They create warm, playful environments where young people feel safe to explore their feelings and build resilience.",
        offerings: [
            { name: "Child Session (45 min)", price: 140, duration: "45 min" },
            { name: "Teen Session (50 min)", price: 150, duration: "50 min" },
            { name: "Family Play Therapy (60 min)", price: 180, duration: "60 min" }
        ],
        startingPrice: 140,
        videoUrl: '',
        featured: false,
        verified: true
    }
];

// ============================================
// Data Mapping: Supabase <-> Frontend
// ============================================
// Supabase uses snake_case columns, frontend uses camelCase

function mapFromSupabase(row) {
    return {
        id: row.id,
        name: row.name,
        credentials: row.credentials,
        title: row.title,
        avatar: row.avatar,
        color: row.color,
        bgColor: row.bg_color,
        location: row.location,
        specialties: row.specialties || [],
        approaches: row.approaches || [],
        sports: row.sports || [],
        sessionTypes: row.session_types || [],
        bio: row.bio,
        offerings: row.offerings || [],
        startingPrice: parseFloat(row.starting_price),
        videoUrl: row.video_url || '',
        featured: row.featured,
        verified: row.verified
    };
}

function mapToSupabase(p) {
    return {
        name: p.name,
        credentials: p.credentials,
        title: p.title,
        avatar: p.avatar,
        color: p.color,
        bg_color: p.bgColor,
        location: p.location,
        specialties: p.specialties,
        approaches: p.approaches,
        sports: p.sports || [],
        session_types: p.sessionTypes,
        bio: p.bio,
        offerings: p.offerings,
        starting_price: p.startingPrice,
        video_url: p.videoUrl || null,
        featured: p.featured || false,
        verified: p.verified || false
    };
}

// ============================================
// Data Persistence Layer
// ============================================
const STORAGE_KEY = 'hometeamgo_practitioners';

// Load from localStorage (fallback)
function loadFromLocalStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.warn('Failed to load from localStorage:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_PRACTITIONERS));
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(practitioners));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

// Load practitioners from Supabase
async function loadFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('practitioners')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;
        if (!data || data.length === 0) return null;

        return data.map(mapFromSupabase);
    } catch (e) {
        console.error('Supabase load error:', e);
        return null;
    }
}

// Load practitioners (tries Supabase first, falls back to localStorage)
async function loadPractitioners() {
    if (isSupabaseConnected) {
        const data = await loadFromSupabase();
        if (data) return data;
    }
    return loadFromLocalStorage();
}

// Save single practitioner (create)
async function createPractitioner(practitionerData) {
    if (isSupabaseConnected && isAdminAuthenticated) {
        try {
            const { data, error } = await supabaseClient
                .from('practitioners')
                .insert([mapToSupabase(practitionerData)])
                .select();

            if (error) throw error;
            return mapFromSupabase(data[0]);
        } catch (e) {
            console.error('Supabase create error:', e);
            showToast('Failed to save to database. Saving locally.', 'error');
        }
    }
    // Fallback: add to local array and save
    const newP = { ...practitionerData, id: getNextId() };
    practitioners.push(newP);
    saveToLocalStorage();
    return newP;
}

// Update practitioner
async function updatePractitioner(id, updates) {
    if (isSupabaseConnected && isAdminAuthenticated) {
        try {
            const { data, error } = await supabaseClient
                .from('practitioners')
                .update(mapToSupabase(updates))
                .eq('id', id)
                .select();

            if (error) throw error;
            // Update local copy
            const index = practitioners.findIndex(p => p.id === id);
            if (index !== -1) {
                practitioners[index] = mapFromSupabase(data[0]);
            }
            return practitioners[index];
        } catch (e) {
            console.error('Supabase update error:', e);
            showToast('Failed to update in database. Saving locally.', 'error');
        }
    }
    // Fallback: update local
    const index = practitioners.findIndex(p => p.id === id);
    if (index !== -1) {
        practitioners[index] = { ...practitioners[index], ...updates };
        saveToLocalStorage();
        return practitioners[index];
    }
    return null;
}

// Delete practitioner
async function deletePractitioner(id) {
    if (isSupabaseConnected && isAdminAuthenticated) {
        try {
            const { error } = await supabaseClient
                .from('practitioners')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (e) {
            console.error('Supabase delete error:', e);
            showToast('Failed to delete from database. Removing locally.', 'error');
        }
    }
    // Remove from local array
    const index = practitioners.findIndex(p => p.id === id);
    if (index !== -1) {
        practitioners.splice(index, 1);
        saveToLocalStorage();
    }
}

// Toggle field (featured/verified)
async function toggleField(id, field) {
    const p = practitioners.find(pr => pr.id === id);
    if (!p) return;

    const newValue = !p[field];

    if (isSupabaseConnected && isAdminAuthenticated) {
        try {
            const updateObj = {};
            updateObj[field] = newValue;
            const { error } = await supabaseClient
                .from('practitioners')
                .update(updateObj)
                .eq('id', id);

            if (error) throw error;
        } catch (e) {
            console.error(`Supabase toggle ${field} error:`, e);
        }
    }
    p[field] = newValue;
    saveToLocalStorage();
}

function getNextId() {
    if (practitioners.length === 0) return 1;
    return Math.max(...practitioners.map(p => p.id)) + 1;
}

// ============================================
// Toast Notification System
// ============================================
function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
        <span class="toast__message">${escapeHTML(message)}</span>
        <button class="toast__close" onclick="this.parentElement.remove()">&times;</button>
    `;
    document.body.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 4000);
}

// ============================================
// Admin Authentication (Supabase Auth)
// ============================================
let isAdminAuthenticated = false;

function showAdminLogin() {
    const gate = document.getElementById('adminLoginGate');
    const dash = document.getElementById('adminDashboard');
    if (gate) gate.style.display = 'flex';
    if (dash) dash.style.display = 'none';
    updateConnectionBadge();
}

function showAdminDashboard() {
    const gate = document.getElementById('adminLoginGate');
    const dash = document.getElementById('adminDashboard');
    if (gate) gate.style.display = 'none';
    if (dash) dash.style.display = 'flex';
    updateConnectionBadge();
    renderAdminStats();
    renderCategoryManager();
    renderAdminTable();
}

// ============================================
// Admin Sidebar Navigation
// ============================================
function switchAdminSection(section) {
    // Toggle sections
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('adminSection-' + section);
    if (target) target.classList.add('active');

    // Toggle sidebar items
    document.querySelectorAll('.admin-sidebar__item').forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`.admin-sidebar__item[data-section="${section}"]`);
    if (activeItem) activeItem.classList.add('active');

    // Close mobile sidebar
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) sidebar.classList.remove('mobile-open');
}

function toggleAdminSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar) sidebar.classList.toggle('mobile-open');
}

async function adminLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('adminEmailInput');
    const passwordInput = document.getElementById('adminPasswordInput');
    const errorEl = document.getElementById('adminLoginError');

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        errorEl.textContent = 'Please enter both email and password.';
        errorEl.style.display = 'block';
        return;
    }

    // Try Supabase Auth first
    if (isSupabaseConnected) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            isAdminAuthenticated = true;
            showAdminDashboard();
            showToast('Signed in successfully!', 'success');
            emailInput.value = '';
            passwordInput.value = '';
            errorEl.style.display = 'none';

            // Reload data (now we're authenticated, we get fresh data)
            const freshData = await loadFromSupabase();
            if (freshData) {
                practitioners.length = 0;
                freshData.forEach(p => practitioners.push(p));
                filteredPractitioners = [...practitioners];
                renderAdminTable();
                renderAdminStats();
            }
            return;
        } catch (err) {
            console.error('Supabase auth error:', err);
            // If Supabase is connected but auth fails, show the error
            errorEl.textContent = err.message || 'Authentication failed. Check your credentials.';
            errorEl.style.display = 'block';
            passwordInput.value = '';
            return;
        }
    }

    // Fallback: local mode requires Supabase to be connected for admin access
    errorEl.textContent = 'Authentication failed. Please check your credentials.';
    errorEl.style.display = 'block';
    passwordInput.value = '';
}

async function adminLogout() {
    if (isSupabaseConnected && supabaseClient) {
        try {
            await supabaseClient.auth.signOut();
        } catch (e) {
            console.error('Supabase sign out error:', e);
        }
    }
    isAdminAuthenticated = false;
    currentUser = null;
    currentUserRole = null;
    sessionStorage.removeItem('hometeamgo_admin');
    updateHeaderForAuth();
    showAdminLogin();
    navigateTo('home');
    showToast('Signed out successfully.', 'info');
}

// Check if already authenticated (on page load / navigation)
async function checkAuth() {
    if (isSupabaseConnected) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                isAdminAuthenticated = true;
                return true;
            }
        } catch (e) {
            console.error('Auth check error:', e);
        }
    }
    return false;
}

// Update connection status badge in admin
function updateConnectionBadge() {
    const badge = document.getElementById('connectionBadge');
    if (!badge) return;
    if (isSupabaseConnected) {
        badge.className = 'connection-badge connection-badge--connected';
        badge.innerHTML = '<span class="connection-badge__dot"></span> Supabase Connected';
    } else {
        badge.className = 'connection-badge connection-badge--local';
        badge.innerHTML = '<span class="connection-badge__dot"></span> Local Mode';
    }
}

// ============================================
// State Management
// ============================================
let practitioners = [];
let currentPage = 'home';
let currentPractitionerPage = 1;
const practitionersPerPage = 9;
let filteredPractitioners = [];

// ============================================
// Navigation
// ============================================
function navigateTo(page) {
    // Remove active from all pages and nav links
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav__link').forEach(l => l.classList.remove('active'));

    // Activate target page
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Activate nav link
    const targetLink = document.querySelector(`.nav__link[data-page="${page}"]`);
    if (targetLink) targetLink.classList.add('active');

    currentPage = page;

    // Close mobile menu
    closeMobileMenu();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // If going to practitioners, render the grid
    if (page === 'practitioners') {
        applyFilters();
    }

    // If going to admin, check auth
    if (page === 'admin') {
        checkAuth().then(authed => {
            if (authed) {
                showAdminDashboard();
            } else {
                showAdminLogin();
            }
        });
    }

    // If going to athlete dashboard, load profile and data
    if (page === 'athlete-dashboard') {
        if (!currentUser || currentUserRole !== 'athlete') {
            openAuthModal('signin');
            navigateTo('home');
            return false;
        }
        loadAthleteProfile();
        loadFavorites().then(() => renderAthleteFavorites());
        loadBookings().then(() => renderAthleteBookings());
    }

    // If going to practitioner dashboard, load data
    if (page === 'practitioner-dashboard') {
        if (!currentUser || currentUserRole !== 'practitioner') {
            openAuthModal('signin');
            navigateTo('home');
            return false;
        }
        loadPractitionerDashboard();
    }

    // If going to messages, load conversations
    if (page === 'messages') {
        if (!currentUser) {
            openAuthModal('signin');
            navigateTo('home');
            return false;
        }
        loadConversations().then(() => renderConversationList());
        startMessagePolling();
    }

    return false;
}

// ============================================
// Mobile Menu
// ============================================
function toggleMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobileNav');
    hamburger.classList.toggle('active');
    mobileNav.classList.toggle('active');
}

function closeMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const mobileNav = document.getElementById('mobileNav');
    if (hamburger) hamburger.classList.remove('active');
    if (mobileNav) mobileNav.classList.remove('active');
}

// ============================================
// Header Scroll Effect
// ============================================
window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 20) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// ============================================
// Filtering
// ============================================
function applyFilters() {
    const searchQuery = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const priceMax = parseInt(document.getElementById('priceRange')?.value || 300);
    const sortBy = document.getElementById('sortSelect')?.value || 'featured';

    // Get checked specialties
    const specialtyChecks = document.querySelectorAll('#specialtyFilters input:checked');
    const selectedSpecialties = Array.from(specialtyChecks).map(cb => cb.value);

    // Get checked approaches
    const approachChecks = document.querySelectorAll('#approachFilters input:checked');
    const selectedApproaches = Array.from(approachChecks).map(cb => cb.value);

    // Get checked sports
    const sportChecks = document.querySelectorAll('#sportFilters input:checked');
    const selectedSports = Array.from(sportChecks).map(cb => cb.value);

    // Get checked session types
    const sessionChecks = document.querySelectorAll('.session-filter:checked');
    const selectedSessions = Array.from(sessionChecks).map(cb => cb.value);

    // Apply filters
    filteredPractitioners = practitioners.filter(p => {
        // Search
        if (searchQuery) {
            const searchFields = [
                p.name, p.title, p.location, p.bio,
                ...p.specialties, ...p.approaches, ...(p.sports || [])
            ].join(' ').toLowerCase();
            if (!searchFields.includes(searchQuery)) return false;
        }

        // Price
        if (p.startingPrice > priceMax) return false;

        // Specialties
        if (selectedSpecialties.length > 0) {
            if (!selectedSpecialties.some(s => p.specialties.includes(s))) return false;
        }

        // Approaches
        if (selectedApproaches.length > 0) {
            if (!selectedApproaches.some(a => p.approaches.includes(a))) return false;
        }

        // Sports
        if (selectedSports.length > 0) {
            if (!selectedSports.some(s => (p.sports || []).includes(s))) return false;
        }

        // Session types
        if (selectedSessions.length > 0) {
            if (!selectedSessions.some(s => p.sessionTypes.includes(s))) return false;
        }

        return true;
    });

    // Sort
    switch (sortBy) {
        case 'price-low':
            filteredPractitioners.sort((a, b) => a.startingPrice - b.startingPrice);
            break;
        case 'price-high':
            filteredPractitioners.sort((a, b) => b.startingPrice - a.startingPrice);
            break;
        case 'name':
            filteredPractitioners.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'featured':
        default:
            filteredPractitioners.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.name.localeCompare(b.name));
            break;
    }

    // Reset to page 1
    currentPractitionerPage = 1;

    // Render
    renderPractitioners();
    renderActiveFilters(selectedSpecialties, selectedApproaches, selectedSports, selectedSessions);
    renderPagination();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('priceRange').value = 300;
    document.getElementById('priceLabel').textContent = 'Up to $300';
    document.getElementById('sortSelect').value = 'featured';

    document.querySelectorAll('#specialtyFilters input, #approachFilters input, #sportFilters input, .session-filter').forEach(cb => {
        cb.checked = false;
    });

    applyFilters();
}

function filterByCategory(category) {
    navigateTo('practitioners');
    resetFilters();

    // Check the matching specialty checkbox
    const checkboxes = document.querySelectorAll('#specialtyFilters input');
    checkboxes.forEach(cb => {
        if (cb.value === category) cb.checked = true;
    });

    applyFilters();
}

function removeFilter(type, value) {
    if (type === 'specialty') {
        const cb = document.querySelector(`#specialtyFilters input[value="${value}"]`);
        if (cb) cb.checked = false;
    } else if (type === 'approach') {
        const cb = document.querySelector(`#approachFilters input[value="${value}"]`);
        if (cb) cb.checked = false;
    } else if (type === 'sport') {
        const cb = document.querySelector(`#sportFilters input[value="${value}"]`);
        if (cb) cb.checked = false;
    } else if (type === 'session') {
        const cb = document.querySelector(`.session-filter[value="${value}"]`);
        if (cb) cb.checked = false;
    }
    applyFilters();
}

function renderActiveFilters(specialties, approaches, sports, sessions) {
    const container = document.getElementById('activeFilters');
    if (!container) return;

    let html = '';

    specialties.forEach(s => {
        html += `<span class="active-filter">${escapeHTML(s)} <span class="active-filter__remove" onclick="removeFilter('specialty', '${escapeHTML(s)}')">&times;</span></span>`;
    });

    approaches.forEach(a => {
        html += `<span class="active-filter">${escapeHTML(a)} <span class="active-filter__remove" onclick="removeFilter('approach', '${escapeHTML(a)}')">&times;</span></span>`;
    });

    sports.forEach(s => {
        html += `<span class="active-filter">${escapeHTML(s)} <span class="active-filter__remove" onclick="removeFilter('sport', '${escapeHTML(s)}')">&times;</span></span>`;
    });

    sessions.forEach(s => {
        html += `<span class="active-filter">${escapeHTML(s)} <span class="active-filter__remove" onclick="removeFilter('session', '${escapeHTML(s)}')">&times;</span></span>`;
    });

    container.innerHTML = html;
}

function updatePriceLabel(value) {
    const label = document.getElementById('priceLabel');
    if (label) label.textContent = `Up to $${value}`;
}

function toggleFilters() {
    const sidebar = document.getElementById('filterSidebar');
    sidebar.classList.toggle('active');
}

// ============================================
// Rendering
// ============================================
function createPractitionerCard(p) {
    const topTags = p.specialties.slice(0, 3);

    return `
        <div class="practitioner-card" onclick="openPractitionerDetail(${parseInt(p.id)})">
            <div class="practitioner-card__header">
                <div class="practitioner-card__bg" style="background: linear-gradient(135deg, ${escapeHTML(p.bgColor)}, ${escapeHTML(p.color)}22);">
                    <span style="opacity: 0.3; font-size: 80px;">🧠</span>
                </div>
                ${p.verified ? '<span class="practitioner-card__verified">✓ Verified</span>' : ''}
                <div class="practitioner-card__avatar" style="background: ${escapeHTML(p.color)};">
                    ${escapeHTML(p.avatar)}
                </div>
            </div>
            <div class="practitioner-card__body">
                <h3 class="practitioner-card__name">${escapeHTML(p.name)}</h3>
                <p class="practitioner-card__title">${escapeHTML(p.title)}</p>
                <p class="practitioner-card__location">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${escapeHTML(p.location)} · ${p.sessionTypes.map(s => escapeHTML(s)).join(' / ')}
                </p>
                <div class="practitioner-card__tags">
                    ${topTags.map((t, i) => `<span class="tag ${i === 0 ? 'tag--primary' : ''}">${escapeHTML(t)}</span>`).join('')}
                </div>
                ${(p.sports && p.sports.length > 0) ? `
                <div class="practitioner-card__sports">
                    ${p.sports.slice(0, 3).map(s => `<span class="tag tag--sport">${escapeHTML(s)}</span>`).join('')}
                </div>` : ''}
                <div class="practitioner-card__meta">
                    <div class="practitioner-card__price">
                        From <strong>$${parseInt(p.startingPrice)}</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPractitioners() {
    const grid = document.getElementById('practitionerGrid');
    const countEl = document.getElementById('resultCount');
    if (!grid) return;

    const start = (currentPractitionerPage - 1) * practitionersPerPage;
    const end = start + practitionersPerPage;
    const pageItems = filteredPractitioners.slice(start, end);

    if (countEl) countEl.textContent = filteredPractitioners.length;

    if (pageItems.length === 0) {
        grid.innerHTML = `
            <div class="no-results" style="grid-column: 1/-1;">
                <div class="no-results__icon">🔍</div>
                <h3>No practitioners found</h3>
                <p>Try adjusting your filters or search terms to find more results.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = pageItems.map(p => createPractitionerCard(p)).join('');
}

function renderFeaturedPractitioners() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;

    const featured = practitioners.filter(p => p.featured).slice(0, 6);
    grid.innerHTML = featured.map(p => createPractitionerCard(p)).join('');
}

function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    const totalPages = Math.ceil(filteredPractitioners.length / practitionersPerPage);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `<button class="pagination__btn" onclick="goToPage(${currentPractitionerPage - 1})" ${currentPractitionerPage === 1 ? 'disabled' : ''}>← Prev</button>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="pagination__btn ${i === currentPractitionerPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    html += `<button class="pagination__btn" onclick="goToPage(${currentPractitionerPage + 1})" ${currentPractitionerPage === totalPages ? 'disabled' : ''}>Next →</button>`;

    container.innerHTML = html;
}

function goToPage(page) {
    const totalPages = Math.ceil(filteredPractitioners.length / practitionersPerPage);
    if (page < 1 || page > totalPages) return;
    currentPractitionerPage = page;
    renderPractitioners();
    renderPagination();

    // Scroll to top of results
    const results = document.querySelector('.results');
    if (results) {
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ============================================
// Practitioner Detail Modal
// ============================================
function openPractitionerDetail(id) {
    const p = practitioners.find(pr => pr.id === id);
    if (!p) return;

    const content = document.getElementById('practitionerModalContent');
    content.innerHTML = `
        <div class="detail-header">
            <div class="detail-avatar" style="background: ${escapeHTML(p.color)};">${escapeHTML(p.avatar)}</div>
            <div class="detail-info">
                <h2>${escapeHTML(p.name)}</h2>
                <p class="detail-credentials">${escapeHTML(p.credentials)}</p>
                <p style="font-size:13px; color: var(--text-muted); margin-bottom: 8px;">
                    📍 ${escapeHTML(p.location)} · ${p.sessionTypes.map(s => escapeHTML(s)).join(' / ')}
                </p>
                <div class="detail-tags">
                    ${p.specialties.map(s => `<span class="tag tag--primary">${escapeHTML(s)}</span>`).join('')}
                    ${p.approaches.map(a => `<span class="tag">${escapeHTML(a)}</span>`).join('')}
                </div>
                ${(p.sports && p.sports.length > 0) ? `
                <div class="detail-sports" style="margin-top: 8px;">
                    <span style="font-size: 12px; color: var(--text-muted); margin-right: 4px;">🏅 Sports:</span>
                    ${p.sports.map(s => `<span class="tag tag--sport">${escapeHTML(s)}</span>`).join('')}
                </div>` : ''}
            </div>
        </div>

        <div class="detail-section">
            <h3>About</h3>
            <p>${escapeHTML(p.bio)}</p>
        </div>

        <div class="detail-section">
            <h3>Offerings</h3>
            <div class="detail-offerings">
                ${p.offerings.map(o => `
                    <div class="offering-item">
                        <div>
                            <div class="offering-item__name">${escapeHTML(o.name)}</div>
                            <div class="offering-item__details">${escapeHTML(o.duration)}</div>
                        </div>
                        <div class="offering-item__price">${o.price === 0 ? 'Free' : '$' + parseInt(o.price)}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        ${p.videoUrl && extractYouTubeId(p.videoUrl) ? `
        <div class="detail-section">
            <h3>Introduction Video</h3>
            <div class="detail-video">
                <iframe src="https://www.youtube.com/embed/${extractYouTubeId(p.videoUrl)}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen
                    title="Introduction video for ${escapeHTML(p.name)}">
                </iframe>
            </div>
        </div>
        ` : ''}

        <div style="display: flex; gap: var(--space-md); margin-top: var(--space-lg);">
            <button class="btn btn--primary btn--full btn--lg" onclick="openBooking(${parseInt(p.id)})" style="flex: 2;">
                Book a Session
            </button>
            ${currentUser && currentUserRole === 'athlete' ? `
            <button class="btn btn--outline btn--lg" onclick="startConversation(${parseInt(p.id)})" title="Send Message">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="favorite-btn ${athleteFavorites.includes(p.id) ? 'favorite-btn--active' : ''}" onclick="toggleFavorite(${parseInt(p.id)})" title="${athleteFavorites.includes(p.id) ? 'Remove from favorites' : 'Add to favorites'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${athleteFavorites.includes(p.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
            ` : ''}
        </div>
    `;

    openModal('practitionerModal');
}

// ============================================
// Booking
// ============================================
function openBooking(id) {
    const p = practitioners.find(pr => pr.id === id);
    if (!p) return;

    // Close practitioner modal
    closeModal('practitionerModal');

    // Fill booking modal
    const practitionerInfo = document.getElementById('bookingPractitioner');
    practitionerInfo.innerHTML = `
        <div class="booking-practitioner__avatar" style="background: ${escapeHTML(p.color)};">${escapeHTML(p.avatar)}</div>
        <div>
            <div class="booking-practitioner__name">${escapeHTML(p.name)}</div>
            <div class="booking-practitioner__title">${escapeHTML(p.title)} · ${escapeHTML(p.location)}</div>
        </div>
    `;

    const sessionSelect = document.getElementById('bookingSessionType');
    sessionSelect.innerHTML = '<option value="">Choose a session type...</option>';
    p.offerings.forEach(o => {
        sessionSelect.innerHTML += `<option value="${escapeHTML(o.name)}">${escapeHTML(o.name)} — ${o.price === 0 ? 'Free' : '$' + parseInt(o.price)}</option>`;
    });

    // Set min date to today
    const dateInput = document.getElementById('bookingDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;

    // Reset form
    document.getElementById('bookingForm').reset();
    document.getElementById('bookingContent').style.display = 'block';
    document.getElementById('bookingSuccess').style.display = 'none';

    // Re-add practitioner info after reset
    practitionerInfo.innerHTML = `
        <div class="booking-practitioner__avatar" style="background: ${escapeHTML(p.color)};">${escapeHTML(p.avatar)}</div>
        <div>
            <div class="booking-practitioner__name">${escapeHTML(p.name)}</div>
            <div class="booking-practitioner__title">${escapeHTML(p.title)} · ${escapeHTML(p.location)}</div>
        </div>
    `;

    sessionSelect.innerHTML = '<option value="">Choose a session type...</option>';
    p.offerings.forEach(o => {
        sessionSelect.innerHTML += `<option value="${escapeHTML(o.name)}">${escapeHTML(o.name)} — ${o.price === 0 ? 'Free' : '$' + parseInt(o.price)}</option>`;
    });

    openModal('bookingModal');
}

function submitBooking(e) {
    e.preventDefault();
    document.getElementById('bookingContent').style.display = 'none';
    document.getElementById('bookingSuccess').style.display = 'block';
}

function submitJoin(e) {
    e.preventDefault();
    e.target.style.display = 'none';
    document.getElementById('joinSuccess').style.display = 'block';
}

// ============================================
// Modals
// ============================================
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';

        // Reset join form when closing
        if (id === 'joinModal') {
            const form = modal.querySelector('.join-form');
            if (form) {
                form.style.display = 'block';
                form.reset();
            }
            document.getElementById('joinSuccess').style.display = 'none';
        }

        // Reset onboarding wizard state when closing
        if (id === 'onboardingModal') {
            wizardState.currentStep = 1;
            wizardState.data = {
                name: '',
                description: '',
                selectedCategories: [],
                sessionPreference: '',
                budgetMax: 300,
                selectedApproaches: []
            };
            wizardState.matchResults = null;
            wizardState.isLoading = false;
            wizardState.error = null;
        }
    }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        const modalId = e.target.id;
        e.target.classList.remove('active');
        document.body.style.overflow = '';

        // Reset wizard if closed via overlay click
        if (modalId === 'onboardingModal') {
            wizardState.currentStep = 1;
            wizardState.data = { name: '', description: '', selectedCategories: [], sessionPreference: '', budgetMax: 300, selectedApproaches: [] };
            wizardState.matchResults = null;
            wizardState.isLoading = false;
            wizardState.error = null;
        }
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            m.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// ============================================
// FAQ
// ============================================
function toggleFaq(item) {
    const isActive = item.classList.contains('active');
    // Close all
    document.querySelectorAll('.faq-item').forEach(f => f.classList.remove('active'));
    // Toggle clicked
    if (!isActive) {
        item.classList.add('active');
    }
}

// ============================================
// Admin Dashboard Functions
// ============================================

// --- Dashboard Stats ---
function renderAdminStats() {
    const container = document.getElementById('adminStats');
    if (!container) return;

    const total = practitioners.length;
    const featuredCount = practitioners.filter(p => p.featured).length;
    const verifiedCount = practitioners.filter(p => p.verified).length;

    const specialtyCounts = {};
    practitioners.forEach(p => {
        p.specialties.forEach(s => {
            specialtyCounts[s] = (specialtyCounts[s] || 0) + 1;
        });
    });
    const topSpecialty = Object.entries(specialtyCounts).sort((a, b) => b[1] - a[1])[0];

    container.innerHTML = `
        <div class="admin-stat-card">
            <div class="admin-stat-card__label">Total Practitioners</div>
            <div class="admin-stat-card__value">${total}</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-card__label">Featured</div>
            <div class="admin-stat-card__value">${featuredCount}</div>
            <div class="admin-stat-card__detail">of ${total} total</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-card__label">Verified</div>
            <div class="admin-stat-card__value">${verifiedCount}</div>
            <div class="admin-stat-card__detail">of ${total} total</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-card__label">Top Specialty</div>
            <div class="admin-stat-card__value" style="font-size:16px;">${topSpecialty ? topSpecialty[0] : 'N/A'}</div>
            <div class="admin-stat-card__detail">${topSpecialty ? topSpecialty[1] + ' practitioners' : ''}</div>
        </div>
    `;
}

// --- Admin Table ---
function renderAdminTable() {
    const tbody = document.getElementById('adminTableBody');
    if (!tbody) return;

    const search = (document.getElementById('adminSearchInput')?.value || '').toLowerCase();
    const filterSpecialty = document.getElementById('adminFilterSpecialty')?.value || '';

    let filtered = practitioners.filter(p => {
        if (search) {
            const fields = [p.name, p.title, p.location, ...(p.specialties || [])].join(' ').toLowerCase();
            if (!fields.includes(search)) return false;
        }
        if (filterSpecialty && !(p.specialties || []).includes(filterSpecialty)) {
            return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 48px; color: var(--text-muted);">No practitioners found matching your search.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => `
        <tr>
            <td>
                <div class="admin-table__practitioner">
                    <div class="admin-table__avatar" style="background: ${escapeHTML(p.color)};">${escapeHTML(p.avatar)}</div>
                    <div>
                        <div class="admin-table__name">${escapeHTML(p.name)}</div>
                        <div class="admin-table__title">${escapeHTML(p.credentials)}</div>
                    </div>
                </div>
            </td>
            <td>${escapeHTML(p.location)}</td>
            <td>
                <div class="admin-table__specialties">
                    ${(p.specialties || []).slice(0, 2).map(s => `<span class="tag">${escapeHTML(s)}</span>`).join('')}
                    ${(p.specialties || []).length > 2 ? `<span class="tag">+${p.specialties.length - 2}</span>` : ''}
                </div>
            </td>
            <td>$${parseInt(p.startingPrice)}</td>
            <td>
                <button class="admin-badge admin-badge--featured ${p.featured ? '' : 'inactive'}" onclick="handleToggleFeatured(${p.id})" title="Toggle Featured">
                    &#9733; ${p.featured ? 'Featured' : 'Not Featured'}
                </button>
                <button class="admin-badge admin-badge--verified ${p.verified ? '' : 'inactive'}" onclick="handleToggleVerified(${p.id})" title="Toggle Verified" style="margin-top:4px;">
                    &#10003; ${p.verified ? 'Verified' : 'Unverified'}
                </button>
            </td>
            <td>
                <div class="admin-actions">
                    <button class="btn btn--outline btn--sm" onclick="openAdminEditModal(${p.id})">Edit</button>
                    <button class="btn btn--danger btn--sm" onclick="openAdminDeleteModal(${p.id})">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// --- Toggle Featured / Verified (async wrappers) ---
async function handleToggleFeatured(id) {
    await toggleField(id, 'featured');
    renderAdminTable();
    renderAdminStats();
}

async function handleToggleVerified(id) {
    await toggleField(id, 'verified');
    renderAdminTable();
    renderAdminStats();
}

// --- Sports Tag Input ---
let adminSportsTags = [];

function handleSportTagKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const input = document.getElementById('adminFormSportsInput');
        const value = input.value.replace(/,/g, '').trim();
        if (value && !adminSportsTags.includes(value)) {
            adminSportsTags.push(value);
            renderAdminSportsTags();
        }
        input.value = '';
    }
}

function removeAdminSportTag(index) {
    adminSportsTags.splice(index, 1);
    renderAdminSportsTags();
}

function renderAdminSportsTags() {
    const container = document.getElementById('adminFormSportsTags');
    if (!container) return;
    container.innerHTML = adminSportsTags.map((tag, i) => `
        <span class="tag-input__tag">${escapeHTML(tag)} <span class="tag-input__tag-remove" onclick="removeAdminSportTag(${i})">&times;</span></span>
    `).join('');
}

// --- Add Practitioner ---
function openAdminAddModal() {
    document.getElementById('adminFormTitle').textContent = 'Add Practitioner';
    document.getElementById('adminPractitionerForm').reset();
    document.getElementById('adminFormId').value = '';
    document.getElementById('adminFormColor').value = '#4b916d';
    document.getElementById('adminFormBgColor').value = '#eef7f0';
    document.getElementById('adminFormVideoUrl').value = '';
    adminSportsTags = [];
    renderAdminSportsTags();
    document.getElementById('adminFormSportsInput').value = '';

    // Re-render dynamic specialty checkboxes in case categories changed
    renderAdminFormSpecialties();

    document.querySelectorAll('#adminFormSpecialties input, #adminFormApproaches input, .admin-session-type').forEach(cb => {
        cb.checked = false;
    });

    openModal('adminFormModal');
}

// --- Edit Practitioner ---
function openAdminEditModal(id) {
    const p = practitioners.find(pr => pr.id === id);
    if (!p) return;

    document.getElementById('adminFormTitle').textContent = 'Edit Practitioner';
    document.getElementById('adminFormId').value = p.id;
    document.getElementById('adminFormName').value = p.name;
    document.getElementById('adminFormCredentials').value = p.credentials;
    document.getElementById('adminFormTitleField').value = p.title;
    document.getElementById('adminFormLocation').value = p.location;
    document.getElementById('adminFormAvatar').value = p.avatar;
    document.getElementById('adminFormColor').value = p.color;
    document.getElementById('adminFormBgColor').value = p.bgColor;
    document.getElementById('adminFormPrice').value = p.startingPrice;
    document.getElementById('adminFormBio').value = p.bio;
    document.getElementById('adminFormVideoUrl').value = p.videoUrl || '';
    adminSportsTags = [...(p.sports || [])];
    renderAdminSportsTags();
    document.getElementById('adminFormSportsInput').value = '';
    document.getElementById('adminFormOfferings').value = JSON.stringify(p.offerings || [], null, 2);

    // Re-render dynamic specialty checkboxes in case categories changed
    renderAdminFormSpecialties();

    document.querySelectorAll('#adminFormSpecialties input').forEach(cb => {
        cb.checked = (p.specialties || []).includes(cb.value);
    });
    document.querySelectorAll('#adminFormApproaches input').forEach(cb => {
        cb.checked = (p.approaches || []).includes(cb.value);
    });
    document.querySelectorAll('.admin-session-type').forEach(cb => {
        cb.checked = (p.sessionTypes || []).includes(cb.value);
    });

    openModal('adminFormModal');
}

// --- Save Practitioner (Add or Edit) ---
async function saveAdminPractitioner(e) {
    e.preventDefault();

    const idVal = document.getElementById('adminFormId').value;
    const isEdit = idVal !== '';

    const specialties = Array.from(document.querySelectorAll('#adminFormSpecialties input:checked')).map(cb => cb.value);
    const approaches = Array.from(document.querySelectorAll('#adminFormApproaches input:checked')).map(cb => cb.value);
    const sessionTypes = Array.from(document.querySelectorAll('.admin-session-type:checked')).map(cb => cb.value);

    if (specialties.length === 0) { alert('Please select at least one specialty.'); return; }
    if (approaches.length === 0) { alert('Please select at least one therapeutic approach.'); return; }
    if (sessionTypes.length === 0) { alert('Please select at least one session type.'); return; }

    let offerings = [];
    try {
        const offeringsVal = document.getElementById('adminFormOfferings').value.trim();
        if (offeringsVal) offerings = JSON.parse(offeringsVal);
    } catch (err) {
        alert('Invalid JSON in offerings field. Please use valid JSON array format.');
        return;
    }

    const practitionerData = {
        name: document.getElementById('adminFormName').value,
        credentials: document.getElementById('adminFormCredentials').value,
        title: document.getElementById('adminFormTitleField').value,
        location: document.getElementById('adminFormLocation').value,
        avatar: document.getElementById('adminFormAvatar').value.toUpperCase(),
        color: document.getElementById('adminFormColor').value,
        bgColor: document.getElementById('adminFormBgColor').value,
        startingPrice: parseFloat(document.getElementById('adminFormPrice').value),
        bio: document.getElementById('adminFormBio').value,
        videoUrl: document.getElementById('adminFormVideoUrl').value.trim(),
        sports: [...adminSportsTags],
        specialties,
        approaches,
        sessionTypes,
        offerings
    };

    if (isEdit) {
        const id = parseInt(idVal);
        const existing = practitioners.find(p => p.id === id);
        if (existing) {
            await updatePractitioner(id, { ...existing, ...practitionerData });
        }
    } else {
        const newP = await createPractitioner({
            ...practitionerData,
            featured: false,
            verified: false
        });
        if (newP && !practitioners.find(p => p.id === newP.id)) {
            practitioners.push(newP);
        }
    }

    filteredPractitioners = [...practitioners];
    renderAdminTable();
    renderAdminStats();
    closeModal('adminFormModal');
    showToast(isEdit ? 'Practitioner updated!' : 'Practitioner added!', 'success');
}

// --- Delete Practitioner ---
let pendingDeleteId = null;

function openAdminDeleteModal(id) {
    const p = practitioners.find(pr => pr.id === id);
    if (!p) return;
    pendingDeleteId = id;
    document.getElementById('adminDeleteMessage').textContent = `Are you sure you want to delete "${p.name}"? This action cannot be undone.`;
    openModal('adminDeleteModal');
}

async function confirmDeletePractitioner() {
    if (pendingDeleteId === null) return;
    await deletePractitioner(pendingDeleteId);
    filteredPractitioners = [...practitioners];
    renderAdminTable();
    renderAdminStats();
    pendingDeleteId = null;
    closeModal('adminDeleteModal');
    showToast('Practitioner deleted.', 'info');
}

// --- Export / Import ---
function exportData() {
    const dataStr = JSON.stringify(practitioners, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hometeam_practitioners_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // Enforce file size limit (1MB)
            if (e.target.result.length > 1000000) {
                alert('File too large. Maximum 1MB allowed.');
                return;
            }
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) {
                alert('Invalid format: Expected a JSON array of practitioners.');
                return;
            }
            if (imported.length > 200) {
                alert('Too many practitioners. Maximum 200 allowed.');
                return;
            }
            const requiredFields = ['name', 'specialties', 'approaches'];
            const valid = imported.every(p =>
                requiredFields.every(f => p.hasOwnProperty(f)) &&
                typeof p.name === 'string' &&
                Array.isArray(p.specialties) &&
                Array.isArray(p.approaches)
            );
            if (!valid) {
                alert('Invalid data: Some practitioners are missing required fields or have wrong types.');
                return;
            }
            // Sanitize all string fields in imported data
            imported.forEach(p => {
                Object.keys(p).forEach(key => {
                    if (typeof p[key] === 'string') {
                        p[key] = p[key].replace(/<[^>]*>/g, '').slice(0, 2000);
                    }
                    if (Array.isArray(p[key])) {
                        p[key] = p[key].map(item => {
                            if (typeof item === 'string') return item.replace(/<[^>]*>/g, '').slice(0, 200);
                            if (typeof item === 'object' && item !== null) {
                                Object.keys(item).forEach(k => {
                                    if (typeof item[k] === 'string') item[k] = item[k].replace(/<[^>]*>/g, '').slice(0, 500);
                                });
                            }
                            return item;
                        });
                    }
                });
            });
            if (confirm(`Import ${imported.length} practitioners? This will replace all current data.`)) {
                // If Supabase connected, clear and re-insert
                if (isSupabaseConnected && isAdminAuthenticated) {
                    try {
                        // Delete all existing
                        await supabaseClient.from('practitioners').delete().neq('id', 0);
                        // Insert all imported (map to Supabase format)
                        const mapped = imported.map(p => mapToSupabase(p));
                        const { error } = await supabaseClient.from('practitioners').insert(mapped);
                        if (error) throw error;

                        // Reload from Supabase to get new IDs
                        const freshData = await loadFromSupabase();
                        if (freshData) {
                            practitioners.length = 0;
                            freshData.forEach(p => practitioners.push(p));
                        }
                    } catch (err) {
                        console.error('Supabase import error:', err);
                        showToast('Import to Supabase failed. Saving locally.', 'error');
                        practitioners.length = 0;
                        imported.forEach(p => practitioners.push(p));
                        saveToLocalStorage();
                    }
                } else {
                    practitioners.length = 0;
                    imported.forEach(p => practitioners.push(p));
                    saveToLocalStorage();
                }
                filteredPractitioners = [...practitioners];
                renderAdminTable();
                renderAdminStats();
                showToast(`Imported ${practitioners.length} practitioners!`, 'success');
            }
        } catch (err) {
            alert('Failed to parse JSON file. Please ensure it is valid JSON.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ============================================
// User Authentication & Roles
// ============================================
let currentUser = null;
let currentUserRole = null; // 'athlete', 'practitioner', 'admin', or null
let currentAthleteProfile = null;
let currentPractitionerAccount = null;
let athleteFavorites = [];
let athleteBookings = [];
let conversations = [];
let currentConversation = null;
let messagePollingInterval = null;

// Initialize auth state on page load
async function initAuth() {
    if (!supabaseClient) return;
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user) {
            currentUser = session.user;
            await determineUserRole(session.user);
            updateHeaderForAuth();
        }

        // Listen for auth state changes (including OAuth redirects)
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session && session.user) {
                currentUser = session.user;
                await determineUserRole(session.user);
                updateHeaderForAuth();

                // If this is an OAuth sign-in, ensure profile exists
                if (session.user.app_metadata.provider === 'google') {
                    await ensureProfileForOAuth(session.user);
                }

                closeModal('authModal');
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                currentUserRole = null;
                currentAthleteProfile = null;
                currentPractitionerAccount = null;
                athleteFavorites = [];
                athleteBookings = [];
                updateHeaderForAuth();
                if (currentPage === 'athlete-dashboard' || currentPage === 'practitioner-dashboard' || currentPage === 'messages') {
                    navigateTo('home');
                }
            }
        });
    } catch (e) {
        console.warn('Auth init error:', e);
    }
}

async function determineUserRole(user) {
    if (!supabaseClient || !user) return;

    // Check if athlete
    try {
        const { data: athleteData } = await supabaseClient
            .from('athlete_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (athleteData) {
            currentUserRole = 'athlete';
            currentAthleteProfile = athleteData;
            return;
        }
    } catch (e) { /* not an athlete */ }

    // Check if practitioner
    try {
        const { data: practData } = await supabaseClient
            .from('practitioner_accounts')
            .select('*')
            .eq('id', user.id)
            .single();
        if (practData) {
            currentUserRole = 'practitioner';
            currentPractitionerAccount = practData;
            return;
        }
    } catch (e) { /* not a practitioner */ }

    // Default: could be admin or unknown role
    currentUserRole = null;
}

async function ensureProfileForOAuth(user) {
    if (!supabaseClient) return;
    const meta = user.user_metadata || {};

    // Check if profile already exists
    const { data: existing } = await supabaseClient
        .from('athlete_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

    if (!existing) {
        // Check practitioner accounts too
        const { data: practExisting } = await supabaseClient
            .from('practitioner_accounts')
            .select('id')
            .eq('id', user.id)
            .single();

        if (!practExisting) {
            // Create athlete profile by default for OAuth users
            await supabaseClient.from('athlete_profiles').insert({
                id: user.id,
                email: user.email,
                full_name: meta.full_name || meta.name || 'User',
                avatar_url: meta.avatar_url || meta.picture || '',
                preferences: {}
            });
            currentUserRole = 'athlete';
            currentAthleteProfile = {
                id: user.id,
                email: user.email,
                full_name: meta.full_name || meta.name || 'User',
                avatar_url: meta.avatar_url || meta.picture || '',
                preferences: {}
            };
        }
    }
}

function updateHeaderForAuth() {
    const signedOut = document.getElementById('headerSignedOut');
    const signedIn = document.getElementById('headerSignedIn');
    const avatarEl = document.getElementById('userMenuAvatar');
    const nameEl = document.getElementById('userMenuName');

    // Mobile nav
    document.querySelectorAll('.mobile-nav__signedout').forEach(el => {
        el.style.display = currentUser ? 'none' : 'block';
    });
    document.querySelectorAll('.mobile-nav__signedin').forEach(el => {
        el.style.display = currentUser ? 'block' : 'none';
    });

    if (currentUser) {
        if (signedOut) signedOut.style.display = 'none';
        if (signedIn) signedIn.style.display = 'flex';

        const name = currentAthleteProfile?.full_name || currentPractitionerAccount?.full_name || currentUser.email?.split('@')[0] || 'User';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        if (avatarEl) avatarEl.textContent = initials;
        if (nameEl) nameEl.textContent = name;
    } else {
        if (signedOut) signedOut.style.display = 'flex';
        if (signedIn) signedIn.style.display = 'none';
    }
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

// Close user menu when clicking outside
document.addEventListener('click', function(e) {
    const menu = document.getElementById('userMenu');
    const dropdown = document.getElementById('userMenuDropdown');
    if (menu && dropdown && !menu.contains(e.target)) {
        dropdown.classList.remove('active');
    }
});

function navigateToUserDashboard() {
    if (currentUserRole === 'athlete') {
        navigateTo('athlete-dashboard');
    } else if (currentUserRole === 'practitioner') {
        navigateTo('practitioner-dashboard');
    } else {
        navigateTo('home');
    }
    // Close dropdown
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) dropdown.classList.remove('active');
}

// ============================================
// Auth Modal
// ============================================
function openAuthModal(mode) {
    openModal('authModal');
    switchAuthTab(mode || 'signin');
}

function switchAuthTab(tab) {
    const signInTab = document.getElementById('authTabSignIn');
    const signUpTab = document.getElementById('authTabSignUp');
    const signInForm = document.getElementById('authSignInForm');
    const signUpForm = document.getElementById('authSignUpForm');
    const title = document.getElementById('authModalTitle');
    const subtitle = document.getElementById('authModalSubtitle');

    if (tab === 'signin') {
        signInTab.classList.add('active');
        signUpTab.classList.remove('active');
        signInForm.style.display = 'block';
        signUpForm.style.display = 'none';
        if (title) title.textContent = 'Sign In';
        if (subtitle) subtitle.textContent = 'Welcome back! Sign in to your account.';
    } else {
        signInTab.classList.remove('active');
        signUpTab.classList.add('active');
        signInForm.style.display = 'none';
        signUpForm.style.display = 'block';
        if (title) title.textContent = 'Create Account';
        if (subtitle) subtitle.textContent = 'Join HomeTeam to save favorites and book sessions.';
    }
    // Clear errors
    document.querySelectorAll('.auth-error').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
}

async function athleteSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('authSignInEmail').value;
    const password = document.getElementById('authSignInPassword').value;
    const errorEl = document.getElementById('authSignInError');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Welcome back!', 'success');
        closeModal('authModal');
    } catch (err) {
        errorEl.textContent = err.message || 'Invalid email or password.';
        errorEl.style.display = 'block';
    }
}

async function athleteSignUp(e) {
    e.preventDefault();
    const name = document.getElementById('authSignUpName').value.trim();
    const email = document.getElementById('authSignUpEmail').value;
    const password = document.getElementById('authSignUpPassword').value;
    const role = document.querySelector('input[name="authRole"]:checked')?.value || 'athlete';
    const errorEl = document.getElementById('authSignUpError');

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: { data: { full_name: name, role: role } }
        });
        if (error) throw error;

        if (data.user) {
            if (role === 'athlete') {
                await supabaseClient.from('athlete_profiles').insert({
                    id: data.user.id,
                    email: email,
                    full_name: name,
                    preferences: {}
                });
                currentUserRole = 'athlete';
                currentAthleteProfile = { id: data.user.id, email, full_name: name, preferences: {} };
            } else {
                await supabaseClient.from('practitioner_accounts').insert({
                    id: data.user.id,
                    email: email,
                    full_name: name,
                    status: 'pending'
                });
                currentUserRole = 'practitioner';
                currentPractitionerAccount = { id: data.user.id, email, full_name: name, status: 'pending' };
            }
        }

        showToast('Account created! Welcome to HomeTeam.', 'success');
        closeModal('authModal');
        updateHeaderForAuth();
    } catch (err) {
        errorEl.textContent = err.message || 'Failed to create account.';
        errorEl.style.display = 'block';
    }
}

async function googleAuth() {
    if (!supabaseClient) {
        showToast('Authentication service not available.', 'error');
        return;
    }
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        });
        if (error) throw error;
    } catch (err) {
        showToast('Google sign-in failed: ' + (err.message || 'Unknown error'), 'error');
    }
}

async function userSignOut() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    currentUser = null;
    currentUserRole = null;
    currentAthleteProfile = null;
    currentPractitionerAccount = null;
    athleteFavorites = [];
    athleteBookings = [];
    if (messagePollingInterval) {
        clearInterval(messagePollingInterval);
        messagePollingInterval = null;
    }
    updateHeaderForAuth();
    navigateTo('home');
    showToast('Signed out successfully.', 'info');
    // Close dropdown
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) dropdown.classList.remove('active');
}

// ============================================
// Dashboard Section Switching
// ============================================
function switchDashboardSection(dashboardType, section) {
    const prefix = dashboardType === 'athlete' ? 'athleteSection' : 'practitionerSection';
    const page = dashboardType === 'athlete' ? 'page-athlete-dashboard' : 'page-practitioner-dashboard';

    // Toggle sections
    document.querySelectorAll(`#${page} .dashboard-section`).forEach(s => s.classList.remove('active'));
    const target = document.getElementById(prefix + '-' + section);
    if (target) target.classList.add('active');

    // Toggle sidebar items
    document.querySelectorAll(`#${page} .dashboard-sidebar__item`).forEach(item => item.classList.remove('active'));
    const activeItem = document.querySelector(`#${page} .dashboard-sidebar__item[data-section="${section}"]`);
    if (activeItem) activeItem.classList.add('active');
}

// ============================================
// Athlete Dashboard
// ============================================
async function loadAthleteProfile() {
    if (!supabaseClient || !currentUser) return;
    try {
        const { data } = await supabaseClient
            .from('athlete_profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        if (data) {
            currentAthleteProfile = data;
            renderAthleteProfileForm();
        }
    } catch (e) {
        console.warn('Failed to load athlete profile:', e);
    }
}

function renderAthleteProfileForm() {
    if (!currentAthleteProfile) return;
    document.getElementById('athleteFormName').value = currentAthleteProfile.full_name || '';
    document.getElementById('athleteFormEmail').value = currentAthleteProfile.email || '';
    document.getElementById('athleteFormPhone').value = currentAthleteProfile.phone || '';

    // Profile summary in sidebar
    const summary = document.getElementById('athleteProfileSummary');
    if (summary) {
        const initials = (currentAthleteProfile.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        summary.innerHTML = `
            <div class="dashboard-profile-avatar">${escapeHTML(initials)}</div>
            <div class="dashboard-profile-name">${escapeHTML(currentAthleteProfile.full_name || 'User')}</div>
            <div class="dashboard-profile-email">${escapeHTML(currentAthleteProfile.email || '')}</div>
        `;
    }
}

async function saveAthleteProfile(e) {
    e.preventDefault();
    if (!supabaseClient || !currentUser) return;

    const updates = {
        full_name: document.getElementById('athleteFormName').value.trim(),
        phone: document.getElementById('athleteFormPhone').value.trim(),
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await supabaseClient
            .from('athlete_profiles')
            .update(updates)
            .eq('id', currentUser.id);
        if (error) throw error;

        currentAthleteProfile = { ...currentAthleteProfile, ...updates };
        updateHeaderForAuth();
        renderAthleteProfileForm();
        showToast('Profile updated!', 'success');
    } catch (err) {
        showToast('Failed to save profile.', 'error');
    }
}

// ============================================
// Favorites
// ============================================
async function loadFavorites() {
    if (!supabaseClient || !currentUser || currentUserRole !== 'athlete') return;
    try {
        const { data } = await supabaseClient
            .from('athlete_favorites')
            .select('practitioner_id')
            .eq('athlete_id', currentUser.id);
        athleteFavorites = (data || []).map(f => f.practitioner_id);
    } catch (e) {
        console.warn('Failed to load favorites:', e);
    }
}

async function toggleFavorite(practitionerId) {
    if (!currentUser || currentUserRole !== 'athlete') {
        openAuthModal('signin');
        return;
    }
    if (!supabaseClient) return;

    const isFav = athleteFavorites.includes(practitionerId);
    try {
        if (isFav) {
            await supabaseClient
                .from('athlete_favorites')
                .delete()
                .eq('athlete_id', currentUser.id)
                .eq('practitioner_id', practitionerId);
            athleteFavorites = athleteFavorites.filter(id => id !== practitionerId);
            showToast('Removed from favorites.', 'info');
        } else {
            await supabaseClient
                .from('athlete_favorites')
                .insert({ athlete_id: currentUser.id, practitioner_id: practitionerId });
            athleteFavorites.push(practitionerId);
            showToast('Added to favorites!', 'success');
        }
        // Re-render if on practitioners page
        if (currentPage === 'practitioners') applyFilters();
        if (currentPage === 'athlete-dashboard') renderAthleteFavorites();
    } catch (e) {
        showToast('Failed to update favorites.', 'error');
    }
}

function renderAthleteFavorites() {
    const container = document.getElementById('athleteFavoritesList');
    if (!container) return;

    const favPractitioners = practitioners.filter(p => athleteFavorites.includes(p.id));
    if (favPractitioners.length === 0) {
        container.innerHTML = `
            <div class="messages-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <p>No favorites yet</p>
                <small>Heart a practitioner to save them here.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = favPractitioners.map(p => `
        <div class="dashboard-card" onclick="openPractitionerDetail(${parseInt(p.id)})">
            <div class="dashboard-card__avatar" style="background: ${escapeHTML(p.color)};">${escapeHTML(p.avatar)}</div>
            <div class="dashboard-card__info">
                <div class="dashboard-card__name">${escapeHTML(p.name)}</div>
                <div class="dashboard-card__subtitle">${escapeHTML(p.title)}</div>
            </div>
            <button class="favorite-btn favorite-btn--active" onclick="event.stopPropagation(); toggleFavorite(${parseInt(p.id)})">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            </button>
        </div>
    `).join('');
}

// ============================================
// Bookings
// ============================================
async function loadBookings() {
    if (!supabaseClient || !currentUser) return;
    try {
        const { data } = await supabaseClient
            .from('bookings')
            .select('*')
            .eq(currentUserRole === 'athlete' ? 'athlete_id' : 'practitioner_id',
                currentUserRole === 'athlete' ? currentUser.id : currentPractitionerAccount?.practitioner_id)
            .order('created_at', { ascending: false });
        athleteBookings = data || [];
    } catch (e) {
        console.warn('Failed to load bookings:', e);
    }
}

function renderAthleteBookings() {
    const container = document.getElementById('athleteBookingsList');
    if (!container) return;

    if (athleteBookings.length === 0) {
        container.innerHTML = `
            <div class="messages-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>No bookings yet</p>
                <small>Book a session with a practitioner to see it here.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = athleteBookings.map(b => {
        const p = practitioners.find(pr => pr.id === b.practitioner_id);
        const statusClass = b.status === 'confirmed' ? 'status--confirmed' : b.status === 'completed' ? 'status--completed' : b.status === 'cancelled' ? 'status--cancelled' : 'status--pending';
        return `
            <div class="booking-item">
                <div class="booking-item__info">
                    <div class="booking-item__practitioner">${escapeHTML(p ? p.name : 'Unknown Practitioner')}</div>
                    <div class="booking-item__details">${escapeHTML(b.offering_name || 'Session')} · ${b.session_date ? escapeHTML(b.session_date) : 'TBD'}</div>
                </div>
                <span class="booking-item__status ${statusClass}">${escapeHTML(b.status || 'pending')}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// Practitioner Dashboard
// ============================================
async function loadPractitionerDashboard() {
    if (!supabaseClient || !currentUser || !currentPractitionerAccount) return;

    const summary = document.getElementById('practitionerProfileSummary');
    if (summary) {
        const name = currentPractitionerAccount.full_name || 'Practitioner';
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        summary.innerHTML = `
            <div class="dashboard-profile-avatar">${escapeHTML(initials)}</div>
            <div class="dashboard-profile-name">${escapeHTML(name)}</div>
            <div class="dashboard-profile-email">${escapeHTML(currentPractitionerAccount.email || '')}</div>
            <span class="booking-item__status status--${currentPractitionerAccount.status === 'active' ? 'confirmed' : 'pending'}">${escapeHTML(currentPractitionerAccount.status || 'pending')}</span>
        `;
    }

    const profileForm = document.getElementById('practitionerProfileForm');
    if (profileForm) {
        if (currentPractitionerAccount.status !== 'active') {
            profileForm.innerHTML = `
                <div class="messages-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p>Account Pending Approval</p>
                    <small>An admin will review and approve your account. You'll be able to edit your profile once approved.</small>
                </div>
            `;
        } else if (currentPractitionerAccount.practitioner_id) {
            const p = practitioners.find(pr => pr.id === currentPractitionerAccount.practitioner_id);
            if (p) {
                profileForm.innerHTML = `
                    <form onsubmit="savePractitionerProfile(event)">
                        <div class="form-group">
                            <label>Bio</label>
                            <textarea id="practFormBio" rows="4">${escapeHTML(p.bio || '')}</textarea>
                        </div>
                        <div class="form-group">
                            <label>YouTube Video URL</label>
                            <input type="url" id="practFormVideoUrl" value="${escapeHTML(p.videoUrl || '')}" placeholder="https://youtube.com/watch?v=...">
                            <small style="color: var(--text-muted);">Optional intro video</small>
                        </div>
                        <div class="form-group">
                            <label>Location</label>
                            <input type="text" id="practFormLocation" value="${escapeHTML(p.location || '')}">
                        </div>
                        <button type="submit" class="btn btn--primary">Save Profile</button>
                    </form>
                `;
            }
        }
    }

    // Load practitioner bookings
    await loadBookings();
    renderPractitionerBookings();
}

async function savePractitionerProfile(e) {
    e.preventDefault();
    if (!supabaseClient || !currentPractitionerAccount?.practitioner_id) return;

    const updates = {
        bio: document.getElementById('practFormBio')?.value || '',
        video_url: document.getElementById('practFormVideoUrl')?.value || null,
        location: document.getElementById('practFormLocation')?.value || ''
    };

    try {
        const { error } = await supabaseClient
            .from('practitioners')
            .update(updates)
            .eq('id', currentPractitionerAccount.practitioner_id);
        if (error) throw error;

        // Update local data
        const p = practitioners.find(pr => pr.id === currentPractitionerAccount.practitioner_id);
        if (p) {
            p.bio = updates.bio;
            p.videoUrl = updates.video_url || '';
            p.location = updates.location;
        }
        showToast('Profile updated!', 'success');
    } catch (err) {
        showToast('Failed to save profile.', 'error');
    }
}

function renderPractitionerBookings() {
    const container = document.getElementById('practitionerBookingsList');
    if (!container) return;

    if (athleteBookings.length === 0) {
        container.innerHTML = `
            <div class="messages-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <p>No bookings yet</p>
                <small>Bookings from athletes will appear here.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = athleteBookings.map(b => {
        const statusClass = b.status === 'confirmed' ? 'status--confirmed' : b.status === 'completed' ? 'status--completed' : 'status--pending';
        return `
            <div class="booking-item">
                <div class="booking-item__info">
                    <div class="booking-item__practitioner">${escapeHTML(b.offering_name || 'Session')}</div>
                    <div class="booking-item__details">${b.session_date ? escapeHTML(b.session_date) : 'TBD'} · ${escapeHTML(b.notes || 'No notes')}</div>
                </div>
                <span class="booking-item__status ${statusClass}">${escapeHTML(b.status || 'pending')}</span>
            </div>
        `;
    }).join('');
}

// ============================================
// Messaging / Secure Chat
// ============================================
async function startConversation(practitionerId) {
    if (!currentUser || currentUserRole !== 'athlete') {
        openAuthModal('signin');
        return;
    }
    if (!supabaseClient) return;

    try {
        // Check for existing conversation
        const { data: existing } = await supabaseClient
            .from('conversations')
            .select('*')
            .eq('athlete_id', currentUser.id)
            .eq('practitioner_id', practitionerId)
            .single();

        if (existing) {
            currentConversation = existing;
        } else {
            const { data: newConvo, error } = await supabaseClient
                .from('conversations')
                .insert({
                    athlete_id: currentUser.id,
                    practitioner_id: practitionerId
                })
                .select()
                .single();
            if (error) throw error;
            currentConversation = newConvo;
        }

        navigateTo('messages');
        await loadConversations();
        renderConversationList();
        await loadMessages(currentConversation.id);
    } catch (e) {
        showToast('Failed to start conversation.', 'error');
    }
}

async function loadConversations() {
    if (!supabaseClient || !currentUser) return;
    try {
        let query;
        if (currentUserRole === 'athlete') {
            query = supabaseClient
                .from('conversations')
                .select('*')
                .eq('athlete_id', currentUser.id)
                .order('last_message_at', { ascending: false });
        } else {
            // Practitioner - find conversations via practitioner_id
            const practId = currentPractitionerAccount?.practitioner_id;
            if (!practId) return;
            query = supabaseClient
                .from('conversations')
                .select('*')
                .eq('practitioner_id', practId)
                .order('last_message_at', { ascending: false });
        }
        const { data } = await query;
        conversations = data || [];
    } catch (e) {
        console.warn('Failed to load conversations:', e);
    }
}

function renderConversationList() {
    const container = document.getElementById('conversationList');
    if (!container) return;

    if (conversations.length === 0) {
        container.innerHTML = `
            <div class="messages-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p>No conversations yet</p>
                <small>Start a conversation from a practitioner's profile.</small>
            </div>
        `;
        return;
    }

    container.innerHTML = conversations.map(c => {
        const isActive = currentConversation && currentConversation.id === c.id;
        let displayName;
        if (currentUserRole === 'athlete') {
            const p = practitioners.find(pr => pr.id === c.practitioner_id);
            displayName = p ? p.name : 'Practitioner';
        } else {
            displayName = 'Athlete'; // In a full implementation, would look up athlete name
        }
        const time = c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : '';

        return `
            <div class="conversation-item ${isActive ? 'conversation-item--active' : ''}"
                 onclick="selectConversation(${parseInt(c.id)})">
                <div class="conversation-item__avatar">${escapeHTML(displayName.split(' ').map(n => n[0]).join('').slice(0, 2))}</div>
                <div class="conversation-item__info">
                    <div class="conversation-item__name">${escapeHTML(displayName)}</div>
                    <div class="conversation-item__time">${escapeHTML(time)}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function selectConversation(convoId) {
    const convo = conversations.find(c => c.id === convoId);
    if (!convo) return;
    currentConversation = convo;
    renderConversationList();
    await loadMessages(convoId);
}

async function loadMessages(conversationId) {
    if (!supabaseClient) return;
    try {
        const { data } = await supabaseClient
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        renderMessageThread(data || []);

        // Mark messages as read
        if (currentUser) {
            await supabaseClient
                .from('messages')
                .update({ read: true })
                .eq('conversation_id', conversationId)
                .neq('sender_id', currentUser.id)
                .eq('read', false);
        }
    } catch (e) {
        console.warn('Failed to load messages:', e);
    }
}

function renderMessageThread(messages) {
    const container = document.getElementById('messageThread');
    if (!container) return;

    if (!currentConversation) {
        container.innerHTML = `
            <div class="messages-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p>Select a conversation</p>
                <small>Choose a conversation from the left to view messages.</small>
            </div>
        `;
        return;
    }

    let displayName;
    if (currentUserRole === 'athlete') {
        const p = practitioners.find(pr => pr.id === currentConversation.practitioner_id);
        displayName = p ? p.name : 'Practitioner';
    } else {
        displayName = 'Athlete';
    }

    const messagesHtml = messages.map(m => {
        const isMine = m.sender_id === currentUser?.id;
        const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="message-bubble ${isMine ? 'message-bubble--sent' : 'message-bubble--received'}">
                <div class="message-bubble__content">${escapeHTML(m.content)}</div>
                <div class="message-bubble__time">${escapeHTML(time)}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="messages-thread__header">
            <button class="btn btn--text btn--sm messages-back-btn" onclick="closeMessageThread()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h3>${escapeHTML(displayName)}</h3>
        </div>
        <div class="messages-thread__messages" id="messagesContainer">
            ${messagesHtml || '<div class="messages-empty" style="padding:40px 0;"><p>No messages yet. Say hello!</p></div>'}
        </div>
        <div class="message-input">
            <input type="text" id="messageInputField" placeholder="Type a message..." onkeypress="if(event.key==='Enter')sendMessage()">
            <button class="btn btn--primary btn--sm" onclick="sendMessage()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
        </div>
    `;

    // Scroll to bottom
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function closeMessageThread() {
    currentConversation = null;
    renderConversationList();
    const container = document.getElementById('messageThread');
    if (container) {
        container.innerHTML = `
            <div class="messages-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p>Select a conversation</p>
                <small>Choose a conversation from the left to view messages.</small>
            </div>
        `;
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInputField');
    if (!input || !input.value.trim() || !currentConversation || !supabaseClient || !currentUser) return;

    const content = input.value.trim();
    input.value = '';

    try {
        const { error } = await supabaseClient.from('messages').insert({
            conversation_id: currentConversation.id,
            sender_id: currentUser.id,
            content: content
        });
        if (error) throw error;

        // Update conversation last_message_at
        await supabaseClient
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', currentConversation.id);

        // Send email notification
        await sendNotificationEmail(currentConversation, content);

        // Reload messages
        await loadMessages(currentConversation.id);
    } catch (e) {
        showToast('Failed to send message.', 'error');
    }
}

async function sendNotificationEmail(conversation, messageContent) {
    try {
        // Determine recipient
        let recipientEmail, recipientName, senderName;
        if (currentUserRole === 'athlete') {
            // Sending to practitioner - get their email from practitioner_accounts
            const { data: practAccount } = await supabaseClient
                .from('practitioner_accounts')
                .select('email, full_name')
                .eq('practitioner_id', conversation.practitioner_id)
                .single();
            if (!practAccount) return;
            recipientEmail = practAccount.email;
            recipientName = practAccount.full_name || 'Practitioner';
            senderName = currentAthleteProfile?.full_name || 'An athlete';
        } else {
            // Sending to athlete - get their email
            const { data: athleteProfile } = await supabaseClient
                .from('athlete_profiles')
                .select('email, full_name')
                .eq('id', conversation.athlete_id)
                .single();
            if (!athleteProfile) return;
            recipientEmail = athleteProfile.email;
            recipientName = athleteProfile.full_name || 'Athlete';
            senderName = currentPractitionerAccount?.full_name || 'A practitioner';
        }

        // Call notification serverless function
        await fetch('/.netlify/functions/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipientEmail,
                recipientName,
                senderName,
                messagePreview: messageContent.slice(0, 200),
                conversationUrl: window.location.origin + '/#messages'
            })
        });
    } catch (e) {
        // Silent fail - email notification is best-effort
        console.warn('Email notification failed:', e);
    }
}

function startMessagePolling() {
    if (messagePollingInterval) clearInterval(messagePollingInterval);
    messagePollingInterval = setInterval(async () => {
        if (currentConversation && currentPage === 'messages') {
            await loadMessages(currentConversation.id);
        }
        await updateUnreadBadge();
    }, 10000);
}

async function updateUnreadBadge() {
    if (!supabaseClient || !currentUser) return;
    try {
        const { count } = await supabaseClient
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .neq('sender_id', currentUser.id)
            .eq('read', false);

        const badge = document.getElementById('headerUnreadBadge');
        if (badge) {
            if (count && count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (e) { /* silent */ }
}

// ============================================
// Onboarding Wizard
// ============================================
const wizardState = {
    currentStep: 1,
    totalSteps: 6,
    data: {
        name: '',
        description: '',
        selectedCategories: [],
        sessionPreference: '',
        budgetMax: 300,
        selectedApproaches: []
    },
    matchResults: null,
    isLoading: false,
    error: null
};

function openOnboardingWizard() {
    wizardState.currentStep = 1;
    wizardState.data = {
        name: '',
        description: '',
        selectedCategories: [],
        sessionPreference: '',
        budgetMax: 300,
        selectedApproaches: []
    };
    wizardState.matchResults = null;
    wizardState.isLoading = false;
    wizardState.error = null;

    renderWizardStep();
    openModal('onboardingModal');
}

function closeOnboardingWizard() {
    closeModal('onboardingModal');
}

// --- Progress Bar ---
function renderWizardProgress() {
    const stepLabels = ['Welcome', 'Your Needs', 'Categories', 'Preferences', 'Matching', 'Results'];
    const container = document.getElementById('wizardProgress');
    if (!container) return;

    container.innerHTML = stepLabels.map((label, i) => {
        const stepNum = i + 1;
        let stateClass = 'wizard-step-indicator--pending';
        if (stepNum < wizardState.currentStep) stateClass = 'wizard-step-indicator--completed';
        if (stepNum === wizardState.currentStep) stateClass = 'wizard-step-indicator--active';

        return `
            <div class="wizard-step-indicator ${stateClass}">
                <div class="wizard-step-dot">
                    ${stepNum < wizardState.currentStep ? '&#10003;' : stepNum}
                </div>
                <span class="wizard-step-label">${label}</span>
            </div>
        `;
    }).join('');
}

// --- Step Router ---
function renderWizardStep() {
    renderWizardProgress();

    switch (wizardState.currentStep) {
        case 1: renderWizardStep1(); break;
        case 2: renderWizardStep2(); break;
        case 3: renderWizardStep3(); break;
        case 4: renderWizardStep4(); break;
        case 5: renderWizardStep5(); break;
        case 6: renderWizardStep6(); break;
    }

    renderWizardNav();
}

// --- Step 1: Welcome ---
function renderWizardStep1() {
    const body = document.getElementById('wizardBody');
    body.innerHTML = `
        <div class="wizard-step-content">
            <div class="wizard-welcome-icon">🏠</div>
            <h2>Welcome to HomeTeam</h2>
            <p class="wizard-step-desc">Let us help you find the right mental health practitioner. We'll ask a few questions to understand your needs and match you with the best fit.</p>
            <div class="form-group">
                <label>What's your name?</label>
                <input type="text" id="wizardNameInput" value="${wizardState.data.name}" placeholder="Your first name" maxlength="50" oninput="wizardState.data.name = this.value; renderWizardNav();">
            </div>
        </div>
    `;
}

// --- Step 2: What brings you here ---
function renderWizardStep2() {
    const body = document.getElementById('wizardBody');
    body.innerHTML = `
        <div class="wizard-step-content">
            <h2>What brings you here, ${escapeHTML(wizardState.data.name) || 'friend'}?</h2>
            <p class="wizard-step-desc">In your own words, tell us what you're going through and what kind of support you're looking for. The more detail you share, the better we can match you.</p>
            <div class="form-group">
                <textarea id="wizardDescInput" rows="6" placeholder="For example: I've been struggling with anxiety at work and it's affecting my sleep. I'd like to find someone who can help me develop coping strategies and maybe explore why I feel so overwhelmed..." maxlength="1000" oninput="wizardState.data.description = this.value; renderWizardNav();">${wizardState.data.description}</textarea>
                <small style="color: var(--text-muted); float: right;">${wizardState.data.description.length}/1000</small>
            </div>
        </div>
    `;
}

// --- Step 3: Categories ---
function renderWizardStep3() {
    const body = document.getElementById('wizardBody');
    body.innerHTML = `
        <div class="wizard-step-content">
            <h2>What specialties are important to you?</h2>
            <p class="wizard-step-desc">Select all that apply. These help us find practitioners with the right expertise.</p>
            <div class="wizard-categories">
                ${categories.map(cat => {
                    const isSelected = wizardState.data.selectedCategories.includes(cat.name);
                    return `
                        <div class="wizard-category-card ${isSelected ? 'selected' : ''}"
                             onclick="toggleWizardCategory('${escapeHTML(cat.name).replace(/'/g, "\\'")}')">
                            <div class="wizard-category-card__icon">${escapeHTML(cat.icon)}</div>
                            <span>${escapeHTML(cat.name)}</span>
                            <div class="wizard-category-card__check">${isSelected ? '&#10003;' : ''}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

function toggleWizardCategory(name) {
    const idx = wizardState.data.selectedCategories.indexOf(name);
    if (idx === -1) {
        wizardState.data.selectedCategories.push(name);
    } else {
        wizardState.data.selectedCategories.splice(idx, 1);
    }
    renderWizardStep3();
    renderWizardNav();
}

// --- Step 4: Preferences ---
function renderWizardStep4() {
    const body = document.getElementById('wizardBody');
    const approaches = ['CBT', 'DBT', 'EMDR', 'Psychodynamic', 'Somatic', 'Humanistic', 'Art Therapy', 'Holistic'];

    body.innerHTML = `
        <div class="wizard-step-content">
            <h2>Your preferences</h2>
            <p class="wizard-step-desc">These are optional but help us refine your matches.</p>

            <div class="form-group">
                <label>Session type preference</label>
                <div class="wizard-session-options">
                    <div class="wizard-session-option ${wizardState.data.sessionPreference === 'In-Person' ? 'selected' : ''}"
                         onclick="selectSessionPref('In-Person')">
                        <div style="font-size: 24px; margin-bottom: 4px;">🏢</div>
                        In-Person
                    </div>
                    <div class="wizard-session-option ${wizardState.data.sessionPreference === 'Virtual' ? 'selected' : ''}"
                         onclick="selectSessionPref('Virtual')">
                        <div style="font-size: 24px; margin-bottom: 4px;">💻</div>
                        Virtual
                    </div>
                    <div class="wizard-session-option ${wizardState.data.sessionPreference === '' ? 'selected' : ''}"
                         onclick="selectSessionPref('')">
                        <div style="font-size: 24px; margin-bottom: 4px;">🤷</div>
                        No Preference
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Maximum budget per session: <strong>$${wizardState.data.budgetMax}</strong></label>
                <div class="price-range">
                    <input type="range" min="50" max="500" value="${wizardState.data.budgetMax}" id="wizardBudgetRange"
                           oninput="wizardState.data.budgetMax = parseInt(this.value); this.previousElementSibling?.remove(); this.closest('.form-group').querySelector('strong').textContent = '$' + this.value;">
                    <div class="price-range__labels">
                        <span>$50</span>
                        <span>$500</span>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label>Preferred therapeutic approaches (optional)</label>
                <div class="wizard-approaches">
                    ${approaches.map(a => {
                        const isSelected = wizardState.data.selectedApproaches.includes(a);
                        return `
                            <label class="filter-check">
                                <input type="checkbox" value="${a}" ${isSelected ? 'checked' : ''}
                                       onchange="toggleWizardApproach('${a}')">
                                <span>${a}</span>
                            </label>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function selectSessionPref(pref) {
    wizardState.data.sessionPreference = pref;
    renderWizardStep4();
}

function toggleWizardApproach(approach) {
    const idx = wizardState.data.selectedApproaches.indexOf(approach);
    if (idx === -1) {
        wizardState.data.selectedApproaches.push(approach);
    } else {
        wizardState.data.selectedApproaches.splice(idx, 1);
    }
}

// --- Step 5: Loading / Matching ---
function renderWizardStep5() {
    const body = document.getElementById('wizardBody');

    if (wizardState.error) {
        body.innerHTML = `
            <div class="wizard-loading">
                <div class="booking-success__icon">⚠️</div>
                <h3>Something went wrong</h3>
                <p style="margin-bottom: var(--space-lg);">${escapeHTML(wizardState.error)}</p>
                <button class="btn btn--primary" onclick="fetchMatches()">Try Again</button>
            </div>
        `;
        return;
    }

    body.innerHTML = `
        <div class="wizard-loading">
            <div class="wizard-loading__spinner"></div>
            <h3>Finding your perfect match...</h3>
            <p>We're analyzing practitioner profiles to find the best fit for your needs.</p>
        </div>
    `;
}

// --- Step 6: Results ---
function renderWizardStep6() {
    const body = document.getElementById('wizardBody');

    if (!wizardState.matchResults || wizardState.matchResults.length === 0) {
        body.innerHTML = `
            <div class="wizard-loading">
                <div class="booking-success__icon">🔍</div>
                <h3>No matches found</h3>
                <p>We couldn't find matches based on your criteria. Try adjusting your preferences or browse all practitioners.</p>
                <div style="display: flex; gap: var(--space-md); justify-content: center; margin-top: var(--space-lg);">
                    <button class="btn btn--outline" onclick="openOnboardingWizard()">Start Over</button>
                    <button class="btn btn--primary" onclick="closeOnboardingWizard(); navigateTo('practitioners');">Browse All</button>
                </div>
            </div>
        `;
        return;
    }

    body.innerHTML = `
        <div class="wizard-step-content">
            <h2>Your Top Matches${wizardState.data.name ? ', ' + escapeHTML(wizardState.data.name.split(' ')[0]) : ''}!</h2>
            <p class="wizard-step-desc">Based on your needs, here are the practitioners we think would be the best fit for you.</p>
            <div class="wizard-matches">
                ${wizardState.matchResults.map(match => {
                    const p = practitioners.find(pr => pr.id === match.id);
                    if (!p) return '';
                    return renderMatchCard(p, match);
                }).join('')}
            </div>
            <div class="wizard-results-footer">
                <button class="btn btn--ghost" onclick="openOnboardingWizard()">Start Over</button>
                <button class="btn btn--outline" onclick="closeOnboardingWizard(); navigateTo('practitioners');">Browse All Practitioners</button>
            </div>
        </div>
    `;
}

function renderMatchCard(p, match) {
    return `
        <div class="wizard-match-card">
            <div class="wizard-match-card__header">
                <div class="wizard-match-card__avatar" style="background: ${escapeHTML(p.color)};">${escapeHTML(p.avatar)}</div>
                <div class="wizard-match-card__info">
                    <h3>${escapeHTML(p.name)}</h3>
                    <p>${escapeHTML(p.title)} &middot; ${escapeHTML(p.location)}</p>
                    <div class="wizard-match-card__price">From $${parseInt(p.startingPrice)}</div>
                </div>
                <div class="wizard-match-card__score">${parseInt(match.score)}%<br><small>match</small></div>
            </div>
            <div class="wizard-match-card__tags">
                ${p.specialties.slice(0, 3).map(s => `<span class="tag tag--primary">${escapeHTML(s)}</span>`).join('')}
                ${(p.sports || []).slice(0, 2).map(s => `<span class="tag tag--sport">${escapeHTML(s)}</span>`).join('')}
            </div>
            <p class="wizard-match-card__reason">${escapeHTML(match.explanation)}</p>
            <div class="wizard-match-card__actions">
                <button class="btn btn--outline btn--sm" onclick="closeOnboardingWizard(); openPractitionerDetail(${parseInt(p.id)});">View Profile</button>
                <button class="btn btn--primary btn--sm" onclick="closeOnboardingWizard(); openBooking(${parseInt(p.id)});">Book Session</button>
            </div>
        </div>
    `;
}

// --- Navigation ---
function renderWizardNav() {
    const nav = document.getElementById('wizardNav');
    if (!nav) return;
    const step = wizardState.currentStep;

    // No nav on loading or results steps
    if (step === 5 || step === 6) {
        nav.innerHTML = '';
        return;
    }

    let html = '';
    if (step > 1) {
        html += `<button class="btn btn--outline" onclick="wizardPrevStep()">Back</button>`;
    } else {
        html += '<div></div>';
    }

    const nextLabel = step === 4 ? 'Find My Matches' : 'Next';
    const disabled = !isWizardStepValid(step) ? 'disabled' : '';
    html += `<button class="btn btn--primary" onclick="wizardNextStep()" ${disabled}>${nextLabel}</button>`;

    nav.innerHTML = html;
}

function isWizardStepValid(step) {
    switch (step) {
        case 1: return wizardState.data.name.trim().length > 0;
        case 2: return wizardState.data.description.trim().length >= 10;
        case 3: return wizardState.data.selectedCategories.length > 0;
        case 4: return true;
        default: return true;
    }
}

function saveCurrentStepData() {
    switch (wizardState.currentStep) {
        case 1:
            const nameInput = document.getElementById('wizardNameInput');
            if (nameInput) wizardState.data.name = nameInput.value;
            break;
        case 2:
            const descInput = document.getElementById('wizardDescInput');
            if (descInput) wizardState.data.description = descInput.value;
            break;
        case 4:
            const budgetInput = document.getElementById('wizardBudgetRange');
            if (budgetInput) wizardState.data.budgetMax = parseInt(budgetInput.value);
            break;
    }
}

function wizardNextStep() {
    saveCurrentStepData();
    if (!isWizardStepValid(wizardState.currentStep)) return;

    wizardState.currentStep++;
    renderWizardStep();

    if (wizardState.currentStep === 5) {
        fetchMatches();
    }
}

function wizardPrevStep() {
    saveCurrentStepData();
    if (wizardState.currentStep > 1) {
        wizardState.currentStep--;
        renderWizardStep();
    }
}

// --- API Call ---
async function fetchMatches() {
    wizardState.isLoading = true;
    wizardState.error = null;
    renderWizardStep();

    try {
        const response = await fetch('/.netlify/functions/match-practitioners', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patient: {
                    name: wizardState.data.name,
                    description: wizardState.data.description,
                    categories: wizardState.data.selectedCategories,
                    sessionPreference: wizardState.data.sessionPreference,
                    budgetMax: wizardState.data.budgetMax,
                    approaches: wizardState.data.selectedApproaches
                },
                practitioners: practitioners.map(p => ({
                    id: p.id,
                    name: p.name,
                    credentials: p.credentials,
                    title: p.title,
                    location: p.location,
                    specialties: p.specialties,
                    approaches: p.approaches,
                    sports: p.sports || [],
                    sessionTypes: p.sessionTypes,
                    bio: p.bio,
                    startingPrice: p.startingPrice,
                    offerings: p.offerings
                }))
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Matching service unavailable. Please try again.');
        }

        const data = await response.json();
        wizardState.matchResults = data.matches;
        wizardState.currentStep = 6;
    } catch (err) {
        wizardState.error = err.message;
    }

    wizardState.isLoading = false;
    renderWizardStep();
}

// ============================================
// Initialize
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Supabase
    initSupabase();

    // Load categories
    loadCategories();

    // Load practitioners (async — tries Supabase first)
    const loadedData = await loadPractitioners();
    practitioners = loadedData;
    filteredPractitioners = [...practitioners];

    // Render all dynamic categories across the app
    renderAllCategories();

    // Render home page
    renderFeaturedPractitioners();

    // Set min date on booking date input
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }

    // Update connection badge if admin page is visible
    updateConnectionBadge();

    // Initialize user authentication
    await initAuth();

    // Load favorites if athlete is logged in
    if (currentUser && currentUserRole === 'athlete') {
        await loadFavorites();
    }

    // Start message polling if logged in
    if (currentUser) {
        startMessagePolling();
    }

    // Listen for Supabase auth state changes (admin-specific)
    if (isSupabaseConnected && supabaseClient) {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                isAdminAuthenticated = true;
            } else if (event === 'SIGNED_OUT') {
                isAdminAuthenticated = false;
            }
        });
    }
});
