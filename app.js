/* ============================================
   HomeTeam — Mental Health Marketplace
   Application Logic (Supabase Backend)
   ============================================ */

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
            <div class="category-card" onclick="filterByCategory('${cat.name.replace(/'/g, "\\'")}')">
                <div class="category-card__icon">${cat.icon}</div>
                <h3>${cat.name}</h3>
                <p>${count} practitioner${count !== 1 ? 's' : ''}</p>
            </div>
        `;
    }).join('');
}

function renderSpecialtyFilters() {
    const container = document.getElementById('specialtyFilters');
    if (!container) return;
    container.innerHTML = categories.map(cat => `
        <label class="filter-check"><input type="checkbox" value="${cat.name}" onchange="applyFilters()"><span>${cat.name}</span></label>
    `).join('');
}

function renderAdminSpecialtyFilter() {
    const select = document.getElementById('adminFilterSpecialty');
    if (!select) return;
    select.innerHTML = '<option value="">All Specialties</option>' +
        categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
}

function renderAdminFormSpecialties() {
    const container = document.getElementById('adminFormSpecialties');
    if (!container) return;
    container.innerHTML = categories.map(cat => `
        <label class="filter-check"><input type="checkbox" value="${cat.name}"><span>${cat.name}</span></label>
    `).join('');
}

function renderFooterCategories() {
    const container = document.getElementById('footerCategories');
    if (!container) return;
    // Show first 4 categories in footer
    container.innerHTML = categories.slice(0, 4).map(cat => `
        <a href="#" onclick="filterByCategory('${cat.name.replace(/'/g, "\\'")}')">${cat.name}</a>
    `).join('');
}

function renderAllCategories() {
    renderHomepageCategories();
    renderSpecialtyFilters();
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
                    <span style="font-size: 24px;">${cat.icon}</span>
                </td>
                <td>
                    <strong>${cat.name}</strong>
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Kim specializes in helping individuals navigate anxiety, depression, and trauma with a warm, evidence-based approach. She is committed to creating a safe, affirming space for clients of all backgrounds and identities.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 175, duration: "50 min" },
            { name: "Initial Consultation (30 min)", price: 0, duration: "30 min" },
            { name: "EMDR Session (80 min)", price: 225, duration: "80 min" }
        ],
        startingPrice: 175,
        rating: 4.9,
        reviewCount: 47,
        reviews: [
            { author: "Jamie L.", stars: 5, text: "Dr. Kim has been an incredible support. She creates such a comfortable environment and her EMDR work has been transformative." },
            { author: "Chris R.", stars: 5, text: "Highly recommend! Dr. Kim helped me understand and manage my anxiety in ways I never thought possible." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Marcus brings over 12 years of experience working with individuals who have experienced trauma, systemic oppression, and substance use challenges. His approach centers cultural identity as a strength in the healing process.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 150, duration: "50 min" },
            { name: "Group Therapy (90 min)", price: 60, duration: "90 min" },
            { name: "Free Consultation (20 min)", price: 0, duration: "20 min" }
        ],
        startingPrice: 150,
        rating: 4.8,
        reviewCount: 62,
        reviews: [
            { author: "Darnell T.", stars: 5, text: "Marcus understands the intersection of identity and mental health in a way I've never experienced with other therapists." },
            { author: "Keisha W.", stars: 5, text: "Life-changing work. Marcus helped me process trauma I'd been carrying for years." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Elena specializes in helping couples and individuals build stronger connections and navigate life transitions. Her approach integrates Gottman method with creative therapeutic techniques to foster growth and understanding.",
        offerings: [
            { name: "Couples Session (75 min)", price: 200, duration: "75 min" },
            { name: "Individual Therapy (50 min)", price: 160, duration: "50 min" },
            { name: "Intensive Couples Retreat (3 hr)", price: 500, duration: "3 hours" }
        ],
        startingPrice: 160,
        rating: 4.9,
        reviewCount: 38,
        reviews: [
            { author: "Taylor & Morgan", stars: 5, text: "Elena saved our relationship. Her couples sessions gave us tools to communicate and understand each other deeply." },
            { author: "Priya S.", stars: 5, text: "Warm, insightful, and incredibly skilled. Elena helped me find my voice." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Okafor brings a culturally responsive lens to therapy, helping clients explore the intersection of identity, family dynamics, and mental health. He specializes in grief work and helping individuals navigate complex emotions.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 185, duration: "50 min" },
            { name: "Grief Support Group (90 min)", price: 45, duration: "90 min" },
            { name: "Initial Assessment (60 min)", price: 200, duration: "60 min" }
        ],
        startingPrice: 185,
        rating: 4.7,
        reviewCount: 29,
        reviews: [
            { author: "Amara B.", stars: 5, text: "Dr. Okafor has a gift for making you feel seen and understood. His grief work is truly exceptional." },
            { author: "Michael K.", stars: 4, text: "Thoughtful, patient, and deeply skilled. Highly recommended for anyone exploring identity and loss." }
        ],
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
        sessionTypes: ["Virtual"],
        bio: "Sage integrates mindfulness, somatic awareness, and nature-based practices into their therapeutic work. They are passionate about helping clients develop a deeper relationship with themselves and find grounding in the present moment.",
        offerings: [
            { name: "Individual Session (50 min)", price: 130, duration: "50 min" },
            { name: "Mindfulness Workshop (2 hr)", price: 75, duration: "2 hours" },
            { name: "Nature-Based Therapy (90 min)", price: 175, duration: "90 min" }
        ],
        startingPrice: 130,
        rating: 5.0,
        reviewCount: 24,
        reviews: [
            { author: "River D.", stars: 5, text: "Sage has completely transformed my relationship with anxiety. Their mindfulness approach is gentle yet powerful." },
            { author: "Ash P.", stars: 5, text: "I finally found a therapist who understands the whole picture. Sage is a true healer." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Chen-Williams is a board-certified psychiatrist specializing in the treatment of anxiety disorders, eating disorders, and adolescent mental health. She takes an integrative approach combining medication management with therapeutic techniques.",
        offerings: [
            { name: "Psychiatric Evaluation (60 min)", price: 250, duration: "60 min" },
            { name: "Medication Management (30 min)", price: 150, duration: "30 min" },
            { name: "Therapy + Med Management (50 min)", price: 225, duration: "50 min" }
        ],
        startingPrice: 150,
        rating: 4.8,
        reviewCount: 53,
        reviews: [
            { author: "Sarah T.", stars: 5, text: "Dr. Chen-Williams is incredibly thorough and caring. She took time to understand my full picture before recommending treatment." },
            { author: "Parent of Client", stars: 5, text: "Our teenager has shown remarkable progress under Dr. Chen-Williams' care. So grateful we found her." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Kai creates a warm, nonjudgmental space for exploring identity, relationships, and intimacy. Their work focuses on helping LGBTQ+ individuals and couples build authentic connections and embrace their full selves.",
        offerings: [
            { name: "Individual Session (50 min)", price: 140, duration: "50 min" },
            { name: "Couples Session (75 min)", price: 190, duration: "75 min" },
            { name: "Free Discovery Call (15 min)", price: 0, duration: "15 min" }
        ],
        startingPrice: 140,
        rating: 4.9,
        reviewCount: 41,
        reviews: [
            { author: "Devon M.", stars: 5, text: "Kai helped me embrace parts of myself I had been suppressing for years. Truly transformative therapy." },
            { author: "Sam & Alex", stars: 5, text: "Our couples sessions with Kai have strengthened our bond immensely. Can't recommend enough." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Hassan specializes in trauma recovery with a culturally sensitive approach. She works with refugees, immigrants, and individuals from diverse backgrounds, understanding the unique challenges that come with navigating multiple cultural identities.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 165, duration: "50 min" },
            { name: "EMDR Intensive (2 hr)", price: 350, duration: "2 hours" },
            { name: "Consultation (30 min)", price: 0, duration: "30 min" }
        ],
        startingPrice: 165,
        rating: 4.9,
        reviewCount: 36,
        reviews: [
            { author: "Fatima R.", stars: 5, text: "Dr. Hassan understands cultural trauma in a way that few therapists do. She has been a lifeline for me." },
            { author: "Yusuf K.", stars: 5, text: "Patient, compassionate, and incredibly effective. Dr. Hassan's EMDR work helped me process deep pain." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Jordan combines evidence-based practices with holistic approaches to support individuals in addiction recovery and trauma healing. Their philosophy centers on meeting clients where they are and building resilience through compassion.",
        offerings: [
            { name: "Individual Session (50 min)", price: 135, duration: "50 min" },
            { name: "Recovery Group (90 min)", price: 40, duration: "90 min" },
            { name: "Intensive Outpatient (3 hr)", price: 275, duration: "3 hours" }
        ],
        startingPrice: 135,
        rating: 4.7,
        reviewCount: 28,
        reviews: [
            { author: "Chris M.", stars: 5, text: "Jordan helped me find a path to recovery that felt authentic to me. Their holistic approach was exactly what I needed." },
            { author: "Anonymous", stars: 4, text: "Supportive, understanding, and knowledgeable. I've made more progress in months than I did in years elsewhere." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Morales specializes in working with children, adolescents, and their families. She uses creative therapeutic approaches including play therapy and art therapy to help young people express themselves and develop healthy coping strategies.",
        offerings: [
            { name: "Child/Teen Session (45 min)", price: 160, duration: "45 min" },
            { name: "Family Session (60 min)", price: 200, duration: "60 min" },
            { name: "Parent Consultation (30 min)", price: 100, duration: "30 min" }
        ],
        startingPrice: 160,
        rating: 4.8,
        reviewCount: 45,
        reviews: [
            { author: "Parent", stars: 5, text: "My daughter actually looks forward to her sessions with Dr. Morales. She has a gift for connecting with young people." },
            { author: "Parent", stars: 5, text: "Dr. Morales helped our family navigate a really difficult time. Her family sessions were incredible." }
        ],
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
        sessionTypes: ["Virtual"],
        bio: "Rowan is a trauma-informed therapist who creates affirming spaces for LGBTQ+ individuals and anyone healing from trauma. They specialize in EMDR and somatic approaches, helping clients reconnect with their bodies and process difficult experiences.",
        offerings: [
            { name: "Individual Session (50 min)", price: 125, duration: "50 min" },
            { name: "EMDR Session (80 min)", price: 180, duration: "80 min" },
            { name: "Free Intro Call (15 min)", price: 0, duration: "15 min" }
        ],
        startingPrice: 125,
        rating: 5.0,
        reviewCount: 19,
        reviews: [
            { author: "Quinn J.", stars: 5, text: "Rowan is one of the most affirming and skilled therapists I've ever worked with. Highly recommend." },
            { author: "Taylor S.", stars: 5, text: "Finally found a therapist who truly gets it. Rowan's virtual sessions feel just as connected as in-person." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Park combines neuroscience with compassionate therapy to help clients understand the brain-mind connection. He specializes in anxiety, eating disorders, and integrating mindfulness practices into evidence-based treatment.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 190, duration: "50 min" },
            { name: "Neuropsych Assessment (3 hr)", price: 600, duration: "3 hours" },
            { name: "DBT Skills Group (90 min)", price: 55, duration: "90 min" }
        ],
        startingPrice: 190,
        rating: 4.6,
        reviewCount: 33,
        reviews: [
            { author: "Michelle T.", stars: 5, text: "Dr. Park helped me understand my brain and gave me concrete tools to manage my eating disorder." },
            { author: "Ryan H.", stars: 4, text: "Highly knowledgeable and compassionate. The neuropsych assessment was eye-opening." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Maya weaves together somatic therapy, mindfulness, and culturally responsive practices to support individuals and couples. Her work honors the wisdom of the body and the importance of cultural identity in the healing journey.",
        offerings: [
            { name: "Individual Session (50 min)", price: 145, duration: "50 min" },
            { name: "Couples Session (75 min)", price: 195, duration: "75 min" },
            { name: "Somatic Yoga Therapy (60 min)", price: 120, duration: "60 min" }
        ],
        startingPrice: 120,
        rating: 4.9,
        reviewCount: 31,
        reviews: [
            { author: "Anjali R.", stars: 5, text: "Maya's approach is unlike anything I've experienced. The combination of talk therapy and somatic work has been transformative." },
            { author: "Couple Client", stars: 5, text: "Maya helped us reconnect on a deeper level. Her couples work is beautiful and effective." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Alex provides bilingual therapy services (English & Spanish) with a focus on addiction recovery, anxiety, and culturally responsive care. They are passionate about breaking down barriers to mental health care in Latinx communities.",
        offerings: [
            { name: "Individual Session (50 min)", price: 120, duration: "50 min" },
            { name: "Group Therapy - Spanish (90 min)", price: 35, duration: "90 min" },
            { name: "Sliding Scale Session (50 min)", price: 75, duration: "50 min" }
        ],
        startingPrice: 75,
        rating: 4.8,
        reviewCount: 44,
        reviews: [
            { author: "Carlos G.", stars: 5, text: "Having therapy in Spanish with someone who understands my culture has made all the difference." },
            { author: "Maria L.", stars: 5, text: "Alex is compassionate and skilled. Their sliding scale made therapy accessible for my family." }
        ],
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
        sessionTypes: ["In-Person", "Virtual"],
        bio: "Dr. Okonkwo specializes in intergenerational trauma, racial stress, and grief within Black and African diaspora communities. Her work is grounded in culturally affirming practices that honor ancestral wisdom alongside evidence-based methods.",
        offerings: [
            { name: "Individual Therapy (50 min)", price: 175, duration: "50 min" },
            { name: "Healing Circle (90 min)", price: 50, duration: "90 min" },
            { name: "EMDR Session (80 min)", price: 220, duration: "80 min" }
        ],
        startingPrice: 175,
        rating: 5.0,
        reviewCount: 27,
        reviews: [
            { author: "Blessing A.", stars: 5, text: "Dr. Okonkwo helped me understand generational patterns I'd been carrying. Her healing circles are powerful." },
            { author: "Tunde O.", stars: 5, text: "Exceptional therapist. Her understanding of cultural trauma is unmatched." }
        ],
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
        sessionTypes: ["In-Person"],
        bio: "Sam specializes in working with children and teens using play therapy, art therapy, and creative expression. They create warm, playful environments where young people feel safe to explore their feelings and build resilience.",
        offerings: [
            { name: "Child Session (45 min)", price: 140, duration: "45 min" },
            { name: "Teen Session (50 min)", price: 150, duration: "50 min" },
            { name: "Family Play Therapy (60 min)", price: 180, duration: "60 min" }
        ],
        startingPrice: 140,
        rating: 4.9,
        reviewCount: 22,
        reviews: [
            { author: "Parent", stars: 5, text: "Sam has a magical way with kids. My son has blossomed since starting therapy." },
            { author: "Parent", stars: 5, text: "Creative, patient, and deeply caring. Sam is a wonderful therapist for children." }
        ],
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
        sessionTypes: row.session_types || [],
        bio: row.bio,
        offerings: row.offerings || [],
        startingPrice: parseFloat(row.starting_price),
        rating: parseFloat(row.rating),
        reviewCount: row.review_count,
        reviews: row.reviews || [],
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
        session_types: p.sessionTypes,
        bio: p.bio,
        offerings: p.offerings,
        starting_price: p.startingPrice,
        rating: p.rating,
        review_count: p.reviewCount,
        reviews: p.reviews || [],
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
        <span class="toast__message">${message}</span>
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
    if (dash) dash.style.display = 'block';
    updateConnectionBadge();
    renderAdminStats();
    renderCategoryManager();
    renderAdminTable();
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

    // Fallback: simple client-side password check for demo/local mode
    if (password === 'hometeam2025') {
        isAdminAuthenticated = true;
        sessionStorage.setItem('hometeamgo_admin', 'true');
        showAdminDashboard();
        showToast('Signed in (local mode)', 'info');
        emailInput.value = '';
        passwordInput.value = '';
        errorEl.style.display = 'none';
    } else {
        errorEl.textContent = 'Incorrect password. Use: hometeam2025 (local mode)';
        errorEl.style.display = 'block';
        passwordInput.value = '';
    }
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
    sessionStorage.removeItem('hometeamgo_admin');
    showAdminLogin();
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
    // Fallback: check sessionStorage
    if (sessionStorage.getItem('hometeamgo_admin') === 'true') {
        isAdminAuthenticated = true;
        return true;
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

    // Get checked session types
    const sessionChecks = document.querySelectorAll('.session-filter:checked');
    const selectedSessions = Array.from(sessionChecks).map(cb => cb.value);

    // Apply filters
    filteredPractitioners = practitioners.filter(p => {
        // Search
        if (searchQuery) {
            const searchFields = [
                p.name, p.title, p.location, p.bio,
                ...p.specialties, ...p.approaches
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

        // Session types
        if (selectedSessions.length > 0) {
            if (!selectedSessions.some(s => p.sessionTypes.includes(s))) return false;
        }

        return true;
    });

    // Sort
    switch (sortBy) {
        case 'rating':
            filteredPractitioners.sort((a, b) => b.rating - a.rating);
            break;
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
            filteredPractitioners.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.rating - a.rating);
            break;
    }

    // Reset to page 1
    currentPractitionerPage = 1;

    // Render
    renderPractitioners();
    renderActiveFilters(selectedSpecialties, selectedApproaches, selectedSessions);
    renderPagination();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('priceRange').value = 300;
    document.getElementById('priceLabel').textContent = 'Up to $300';
    document.getElementById('sortSelect').value = 'featured';

    document.querySelectorAll('#specialtyFilters input, #approachFilters input, .session-filter').forEach(cb => {
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
    } else if (type === 'session') {
        const cb = document.querySelector(`.session-filter[value="${value}"]`);
        if (cb) cb.checked = false;
    }
    applyFilters();
}

function renderActiveFilters(specialties, approaches, sessions) {
    const container = document.getElementById('activeFilters');
    if (!container) return;

    let html = '';

    specialties.forEach(s => {
        html += `<span class="active-filter">${s} <span class="active-filter__remove" onclick="removeFilter('specialty', '${s}')">&times;</span></span>`;
    });

    approaches.forEach(a => {
        html += `<span class="active-filter">${a} <span class="active-filter__remove" onclick="removeFilter('approach', '${a}')">&times;</span></span>`;
    });

    sessions.forEach(s => {
        html += `<span class="active-filter">${s} <span class="active-filter__remove" onclick="removeFilter('session', '${s}')">&times;</span></span>`;
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
    const starsHtml = '★'.repeat(Math.floor(p.rating)) + (p.rating % 1 >= 0.5 ? '½' : '');
    const topTags = p.specialties.slice(0, 3);

    return `
        <div class="practitioner-card" onclick="openPractitionerDetail(${p.id})">
            <div class="practitioner-card__header">
                <div class="practitioner-card__bg" style="background: linear-gradient(135deg, ${p.bgColor}, ${p.color}22);">
                    <span style="opacity: 0.3; font-size: 80px;">🧠</span>
                </div>
                ${p.verified ? '<span class="practitioner-card__verified">✓ Verified</span>' : ''}
                <div class="practitioner-card__avatar" style="background: ${p.color};">
                    ${p.avatar}
                </div>
            </div>
            <div class="practitioner-card__body">
                <h3 class="practitioner-card__name">${p.name}</h3>
                <p class="practitioner-card__title">${p.title}</p>
                <p class="practitioner-card__location">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${p.location} · ${p.sessionTypes.join(' / ')}
                </p>
                <div class="practitioner-card__tags">
                    ${topTags.map((t, i) => `<span class="tag ${i === 0 ? 'tag--primary' : ''}">${t}</span>`).join('')}
                </div>
                <div class="practitioner-card__meta">
                    <div class="practitioner-card__rating">
                        ★ <span>${p.rating}</span> (${p.reviewCount})
                    </div>
                    <div class="practitioner-card__price">
                        From <strong>$${p.startingPrice}</strong>
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
    const starsHtml = '★'.repeat(Math.floor(p.rating));

    content.innerHTML = `
        <div class="detail-header">
            <div class="detail-avatar" style="background: ${p.color};">${p.avatar}</div>
            <div class="detail-info">
                <h2>${p.name}</h2>
                <p class="detail-credentials">${p.credentials}</p>
                <div class="detail-rating">
                    <span class="stars">${starsHtml}</span>
                    <strong>${p.rating}</strong>
                    <span style="color: var(--text-muted);">(${p.reviewCount} reviews)</span>
                </div>
                <p style="font-size:13px; color: var(--text-muted); margin-bottom: 8px;">
                    📍 ${p.location} · ${p.sessionTypes.join(' / ')}
                </p>
                <div class="detail-tags">
                    ${p.specialties.map(s => `<span class="tag tag--primary">${s}</span>`).join('')}
                    ${p.approaches.map(a => `<span class="tag">${a}</span>`).join('')}
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>About</h3>
            <p>${p.bio}</p>
        </div>

        <div class="detail-section">
            <h3>Offerings</h3>
            <div class="detail-offerings">
                ${p.offerings.map(o => `
                    <div class="offering-item">
                        <div>
                            <div class="offering-item__name">${o.name}</div>
                            <div class="offering-item__details">${o.duration}</div>
                        </div>
                        <div class="offering-item__price">${o.price === 0 ? 'Free' : '$' + o.price}</div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="detail-section">
            <h3>Reviews</h3>
            <div class="detail-reviews">
                ${p.reviews.map(r => `
                    <div class="review-item">
                        <div class="review-item__header">
                            <span class="review-item__author">${r.author}</span>
                            <span class="review-item__stars">${'★'.repeat(r.stars)}</span>
                        </div>
                        <p class="review-item__text">${r.text}</p>
                    </div>
                `).join('')}
            </div>
        </div>

        <button class="btn btn--primary btn--full btn--lg" onclick="openBooking(${p.id})" style="margin-top: var(--space-lg);">
            Book a Session with ${p.name.split(',')[0].split(' ').slice(0, 2).join(' ')}
        </button>
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
        <div class="booking-practitioner__avatar" style="background: ${p.color};">${p.avatar}</div>
        <div>
            <div class="booking-practitioner__name">${p.name}</div>
            <div class="booking-practitioner__title">${p.title} · ${p.location}</div>
        </div>
    `;

    const sessionSelect = document.getElementById('bookingSessionType');
    sessionSelect.innerHTML = '<option value="">Choose a session type...</option>';
    p.offerings.forEach(o => {
        sessionSelect.innerHTML += `<option value="${o.name}">${o.name} — ${o.price === 0 ? 'Free' : '$' + o.price}</option>`;
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
        <div class="booking-practitioner__avatar" style="background: ${p.color};">${p.avatar}</div>
        <div>
            <div class="booking-practitioner__name">${p.name}</div>
            <div class="booking-practitioner__title">${p.title} · ${p.location}</div>
        </div>
    `;

    sessionSelect.innerHTML = '<option value="">Choose a session type...</option>';
    p.offerings.forEach(o => {
        sessionSelect.innerHTML += `<option value="${o.name}">${o.name} — ${o.price === 0 ? 'Free' : '$' + o.price}</option>`;
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
    const avgRating = total > 0
        ? (practitioners.reduce((sum, p) => sum + p.rating, 0) / total).toFixed(1)
        : '0.0';
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
            <div class="admin-stat-card__label">Average Rating</div>
            <div class="admin-stat-card__value">${avgRating} &#9733;</div>
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
                    <div class="admin-table__avatar" style="background: ${p.color};">${p.avatar}</div>
                    <div>
                        <div class="admin-table__name">${p.name}</div>
                        <div class="admin-table__title">${p.credentials}</div>
                    </div>
                </div>
            </td>
            <td>${p.location}</td>
            <td>
                <div class="admin-table__specialties">
                    ${(p.specialties || []).slice(0, 2).map(s => `<span class="tag">${s}</span>`).join('')}
                    ${(p.specialties || []).length > 2 ? `<span class="tag">+${p.specialties.length - 2}</span>` : ''}
                </div>
            </td>
            <td>&#9733; ${p.rating} (${p.reviewCount})</td>
            <td>$${p.startingPrice}</td>
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

// --- Add Practitioner ---
function openAdminAddModal() {
    document.getElementById('adminFormTitle').textContent = 'Add Practitioner';
    document.getElementById('adminPractitionerForm').reset();
    document.getElementById('adminFormId').value = '';
    document.getElementById('adminFormColor').value = '#4b916d';
    document.getElementById('adminFormBgColor').value = '#eef7f0';
    document.getElementById('adminFormRating').value = '5.0';
    document.getElementById('adminFormReviewCount').value = '0';

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
    document.getElementById('adminFormRating').value = p.rating;
    document.getElementById('adminFormReviewCount').value = p.reviewCount;
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
        rating: parseFloat(document.getElementById('adminFormRating').value),
        reviewCount: parseInt(document.getElementById('adminFormReviewCount').value) || 0,
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
            reviews: [],
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
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) {
                alert('Invalid format: Expected a JSON array of practitioners.');
                return;
            }
            const requiredFields = ['name', 'specialties', 'approaches'];
            const valid = imported.every(p => requiredFields.every(f => p.hasOwnProperty(f)));
            if (!valid) {
                alert('Invalid data: Some practitioners are missing required fields (name, specialties, approaches).');
                return;
            }
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
            <h2>What brings you here, ${wizardState.data.name || 'friend'}?</h2>
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
                             onclick="toggleWizardCategory('${cat.name.replace(/'/g, "\\'")}')">
                            <div class="wizard-category-card__icon">${cat.icon}</div>
                            <span>${cat.name}</span>
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
                <p style="margin-bottom: var(--space-lg);">${wizardState.error}</p>
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
            <h2>Your Top Matches${wizardState.data.name ? ', ' + wizardState.data.name.split(' ')[0] : ''}!</h2>
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
                <div class="wizard-match-card__avatar" style="background: ${p.color};">${p.avatar}</div>
                <div class="wizard-match-card__info">
                    <h3>${p.name}</h3>
                    <p>${p.title} &middot; ${p.location}</p>
                    <div class="wizard-match-card__rating">&#9733; ${p.rating} (${p.reviewCount}) &middot; From $${p.startingPrice}</div>
                </div>
                <div class="wizard-match-card__score">${match.score}%<br><small>match</small></div>
            </div>
            <div class="wizard-match-card__tags">
                ${p.specialties.slice(0, 3).map(s => `<span class="tag tag--primary">${s}</span>`).join('')}
            </div>
            <p class="wizard-match-card__reason">${match.explanation}</p>
            <div class="wizard-match-card__actions">
                <button class="btn btn--outline btn--sm" onclick="closeOnboardingWizard(); openPractitionerDetail(${p.id});">View Profile</button>
                <button class="btn btn--primary btn--sm" onclick="closeOnboardingWizard(); openBooking(${p.id});">Book Session</button>
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
                    sessionTypes: p.sessionTypes,
                    bio: p.bio,
                    startingPrice: p.startingPrice,
                    rating: p.rating,
                    reviewCount: p.reviewCount,
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

    // Listen for Supabase auth state changes
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
