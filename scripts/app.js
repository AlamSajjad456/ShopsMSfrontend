// scripts/app.js – Final version

// ==================== Configuration ====================
const API_BASE = 'http://localhost:4000/api'; // Change to your actual backend port
let token = localStorage.getItem('token');
let currentUser = null;
let allProducts = [];
let categories = [];
let honeyCategoryId = null;
let pendingAddToCartProductId = null;
let filteredDryProducts = [];
let filteredHoneyProducts = [];
let selectedCategoryId = null;
let selectedSort = 'featured';
let currentSearchQuery = '';
const DRY_PRODUCTS_PAGE_SIZE = 8;
const HONEY_PRODUCTS_PAGE_SIZE = 6;
let dryVisibleCount = DRY_PRODUCTS_PAGE_SIZE;
let honeyVisibleCount = HONEY_PRODUCTS_PAGE_SIZE;
let initialDryMarkup = '';
let initialHoneyMarkup = '';
let initialHoneyProductsMarkup = '';
let activeGalleryProduct = null;
let activeGalleryImages = [];
let activeGalleryIndex = 0;
let activeProductReviews = [];
let galleryTouchStartX = 0;
let galleryLastFocusedElement = null;
const PRODUCT_IMAGE_FALLBACK = 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1200&q=80';
const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);
const ENABLE_STATIC_PRODUCT_FALLBACK = DEV_HOSTS.has(window.location.hostname);

function normalizeProduct(raw = {}) {
    const priceValue = Number(raw.price);
    const stockValue = Number(raw.stock);
    const ratingValue = Number(raw.rating);
    const reviewValue = Number(raw.reviewCount ?? raw.reviewsCount);
    const imagesRaw = Array.isArray(raw.images) ? raw.images : [];
    const images = imagesRaw
        .map((img) => {
            if (typeof img === 'string') {
                return { url: String(img).trim(), isPrimary: false };
            }
            return {
                url: String(img?.url || '').trim(),
                isPrimary: Boolean(img?.isPrimary)
            };
        })
        .filter((img) => img.url);

    return {
        id: Number(raw.id || raw.productId || 0) || 0,
        categoryId: Number(raw.categoryId || 0) || 0,
        name: String(raw.name || raw.title || 'Product'),
        shortDescription: String(raw.shortDescription || raw.description || '').trim(),
        description: String(raw.description || raw.shortDescription || '').trim(),
        price: Number.isFinite(priceValue) ? priceValue : 0,
        stock: Number.isFinite(stockValue) ? stockValue : 0,
        rating: Number.isFinite(ratingValue) && ratingValue > 0 ? Math.min(5, Math.max(0, ratingValue)) : 4.6,
        reviewCount: Number.isFinite(reviewValue) && reviewValue >= 0 ? reviewValue : 125,
        images
    };
}

// ==================== DOM Elements ====================
const honeyProductsGrid = document.getElementById('honeyProductsGrid');
const dryFruitsGrid = document.getElementById('dryFruitsGrid');
const honeyGrid = document.getElementById('honeyGrid');
const cartCountSpan = document.getElementById('cartCount');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const categoryFiltersDiv = document.getElementById('categoryFilters');
const authModal = document.getElementById('authModal');
const loginFormDiv = document.getElementById('loginForm');
const registerFormDiv = document.getElementById('registerForm');
const authModalTitle = document.getElementById('authModalTitle');
const userMenuBtn = document.getElementById('userMenuBtn');
const userDropdown = document.getElementById('userDropdown');
const userNameDisplay = document.getElementById('userNameDisplay');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const cartBtn = document.getElementById('cartBtn');
const authModalCloseBtn = document.getElementById('authModalCloseBtn');
const productsSection = document.getElementById('products');

// Mobile Menu Elements
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');

// ==================== Toast Notification System ====================
function showToast(message, type = 'info', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `px-4 py-3 rounded-lg shadow-lg text-white transform transition-all duration-300 translate-x-0 opacity-100 ${
        type === 'success' ? 'bg-green-600' :
        type === 'error' ? 'bg-red-600' :
        type === 'warning' ? 'bg-yellow-600' : 'bg-blue-600'
    }`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-2');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function debounce(fn, wait = 250) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

function ensureProductControls() {
    if (!categoryFiltersDiv) return;
    if (document.getElementById('shopControlsRow')) return;

    const controlsRow = document.createElement('div');
    controlsRow.id = 'shopControlsRow';
    controlsRow.className = 'mt-4 flex flex-col sm:flex-row gap-3 items-center justify-center';
    controlsRow.innerHTML = `
        <div class="w-full sm:w-auto">
            <select id="sortSelect" class="w-full sm:w-56 bg-white border border-amber-300 text-amber-800 px-4 py-2.5 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-amber-500">
                <option value="featured">Sort: Featured</option>
                <option value="name-asc">Name A-Z</option>
                <option value="name-desc">Name Z-A</option>
                <option value="price-asc">Price Low-High</option>
                <option value="price-desc">Price High-Low</option>
                <option value="stock-desc">Stock High-Low</option>
            </select>
        </div>
        <button id="clearFiltersBtn" class="bg-white text-amber-700 px-4 py-2.5 rounded-xl font-medium border border-amber-300 hover:bg-amber-50 transition-colors">
            Clear Filters
        </button>
        <p id="resultsSummary" class="text-sm text-amber-700"></p>
    `;

    categoryFiltersDiv.insertAdjacentElement('afterend', controlsRow);

    const sortSelect = document.getElementById('sortSelect');
    sortSelect?.addEventListener('change', () => {
        selectedSort = sortSelect.value || 'featured';
        dryVisibleCount = DRY_PRODUCTS_PAGE_SIZE;
        honeyVisibleCount = HONEY_PRODUCTS_PAGE_SIZE;
        applyFiltersAndRender();
    });

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    clearFiltersBtn?.addEventListener('click', () => {
        selectedCategoryId = null;
        selectedSort = 'featured';
        currentSearchQuery = '';
        dryVisibleCount = DRY_PRODUCTS_PAGE_SIZE;
        honeyVisibleCount = HONEY_PRODUCTS_PAGE_SIZE;

        if (searchInput) searchInput.value = '';
        if (sortSelect) sortSelect.value = 'featured';

        const allBtn = document.querySelector('.category-filter[data-category-id="all"]');
        if (allBtn) allBtn.click();
        else applyFiltersAndRender();
    });
}

function ensureLoadMoreButtons() {
    if (dryFruitsGrid && !document.getElementById('dryFruitsLoadMore')) {
        const wrap = document.createElement('div');
        wrap.className = 'text-center mt-8';
        wrap.innerHTML = `
            <button id="dryFruitsLoadMore" class="hidden bg-white text-amber-700 border border-amber-300 px-6 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors">
                Load More Dry Fruits
            </button>
        `;
        dryFruitsGrid.insertAdjacentElement('afterend', wrap);
        wrap.querySelector('#dryFruitsLoadMore')?.addEventListener('click', () => {
            dryVisibleCount += DRY_PRODUCTS_PAGE_SIZE;
            renderProductGrids();
        });
    }

    if (honeyGrid && !document.getElementById('honeyLoadMore')) {
        const wrap = document.createElement('div');
        wrap.className = 'text-center mt-8';
        wrap.innerHTML = `
            <button id="honeyLoadMore" class="hidden bg-white text-amber-700 border border-amber-300 px-6 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors">
                Load More Honey
            </button>
        `;
        honeyGrid.insertAdjacentElement('afterend', wrap);
        wrap.querySelector('#honeyLoadMore')?.addEventListener('click', () => {
            honeyVisibleCount += HONEY_PRODUCTS_PAGE_SIZE;
            renderProductGrids();
        });
    }

    if (honeyProductsGrid && !document.getElementById('honeyProductsLoadMore')) {
        const wrap = document.createElement('div');
        wrap.className = 'text-center mt-8';
        wrap.innerHTML = `
            <button id="honeyProductsLoadMore" class="hidden bg-white text-amber-700 border border-amber-300 px-6 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors">
                Load More Honey
            </button>
        `;
        honeyProductsGrid.insertAdjacentElement('afterend', wrap);
        wrap.querySelector('#honeyProductsLoadMore')?.addEventListener('click', () => {
            honeyVisibleCount += HONEY_PRODUCTS_PAGE_SIZE;
            renderProductGrids();
        });
    }
}

function renderProductSkeletons() {
    const skeletonCard = `
        <div class="bg-white rounded-2xl shadow-md overflow-hidden border border-amber-200 animate-pulse">
            <div class="h-64 bg-amber-100"></div>
            <div class="p-6 space-y-3">
                <div class="h-6 bg-amber-100 rounded"></div>
                <div class="h-5 bg-amber-100 rounded w-1/2"></div>
                <div class="h-4 bg-amber-100 rounded"></div>
                <div class="h-4 bg-amber-100 rounded w-2/3"></div>
            </div>
        </div>
    `;
    if (dryFruitsGrid) dryFruitsGrid.innerHTML = new Array(4).fill(skeletonCard).join('');
    if (honeyGrid) honeyGrid.innerHTML = new Array(3).fill(skeletonCard).join('');
    if (honeyProductsGrid) honeyProductsGrid.innerHTML = new Array(3).fill(skeletonCard).join('');
}

function restoreStaticProductMarkup() {
    if (dryFruitsGrid && initialDryMarkup) dryFruitsGrid.innerHTML = initialDryMarkup;
    if (honeyGrid && initialHoneyMarkup) honeyGrid.innerHTML = initialHoneyMarkup;
    if (honeyProductsGrid && initialHoneyProductsMarkup) honeyProductsGrid.innerHTML = initialHoneyProductsMarkup;
    attachAddToCartListeners();
}

function renderProductsError(message) {
    const errorHtml = `
        <div class="col-span-full text-center py-10">
            <p class="text-red-700 font-medium mb-3">${message}</p>
            <button class="retry-products-btn bg-red-600 text-white px-5 py-2 rounded-lg hover:bg-red-700">
                Retry
            </button>
        </div>
    `;
    if (dryFruitsGrid) dryFruitsGrid.innerHTML = errorHtml;
    if (honeyGrid) honeyGrid.innerHTML = errorHtml;
    if (honeyProductsGrid) honeyProductsGrid.innerHTML = errorHtml;

    document.querySelectorAll('.retry-products-btn').forEach((btn) => btn.addEventListener('click', () => {
        fetchProducts();
    }));
}

// ==================== Helper Functions ====================
function isLoggedIn() { return !!token; }
function authHeaders() { return token ? { 'Authorization': `Bearer ${token}` } : {}; }

function setSession(nextToken, user) {
    token = nextToken;
    currentUser = user || null;
    localStorage.setItem('token', token);
    if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
    else localStorage.removeItem('currentUser');
    updateUIForUser();
}

function clearSession() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    updateUIForUser();
    fetchCart();
}

function openLoginModal() {
    if (!authModal || !loginFormDiv || !registerFormDiv || !authModalTitle) return;
    registerFormDiv.classList.add('hidden');
    loginFormDiv.classList.remove('hidden');
    authModalTitle.textContent = 'Login';
    authModal.classList.remove('hidden');
}

function openRegisterModal() {
    if (!authModal || !loginFormDiv || !registerFormDiv || !authModalTitle) return;
    loginFormDiv.classList.add('hidden');
    registerFormDiv.classList.remove('hidden');
    authModalTitle.textContent = 'Register';
    authModal.classList.remove('hidden');
}

function closeAuthModal() {
    if (authModal) authModal.classList.add('hidden');
}

// ==================== Authentication API calls ====================
async function loginUser(email, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    setSession(data.token, data.user);
    showToast('Login successful!', 'success');
}

async function registerUser(name, email, password) {
    const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    showToast('Registration successful! Please log in.', 'success');
}

// ==================== Authentication UI Handlers ====================
if (document.getElementById('switchToRegister')) {
    document.getElementById('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        openRegisterModal();
    });
}
if (document.getElementById('switchToLogin')) {
    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        openLoginModal();
    });
}

// Login submit
if (document.getElementById('loginSubmit')) {
    document.getElementById('loginSubmit').addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        if (!email || !password) {
            showToast('Please fill all fields', 'warning');
            return;
        }

        try {
            await loginUser(email, password);
            closeAuthModal();
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';

            if (pendingAddToCartProductId) {
                const productId = pendingAddToCartProductId;
                pendingAddToCartProductId = null;
                await addToCart(productId);
            }
            if (pendingOrderProductId) {
                const productId = pendingOrderProductId;
                pendingOrderProductId = null;
                await orderProduct(productId, 1);
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Register submit
if (document.getElementById('registerSubmit')) {
    document.getElementById('registerSubmit').addEventListener('click', async () => {
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        if (!name || !email || !password) {
            showToast('Please fill all fields', 'warning');
            return;
        }

        try {
            await registerUser(name, email, password);
            await loginUser(email, password);
            closeAuthModal();
            document.getElementById('registerName').value = '';
            document.getElementById('registerEmail').value = '';
            document.getElementById('registerPassword').value = '';

            if (pendingAddToCartProductId) {
                const productId = pendingAddToCartProductId;
                pendingAddToCartProductId = null;
                await addToCart(productId);
            }
            if (pendingOrderProductId) {
                const productId = pendingOrderProductId;
                pendingOrderProductId = null;
                await orderProduct(productId, 1);
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// Logout
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        showToast('Logged out', 'info');
    });
}

function updateUIForUser() {
    if (!userNameDisplay) return;
    if (currentUser) {
        userNameDisplay.textContent = currentUser.name || currentUser.email || 'Account';
        userNameDisplay.classList.remove('hidden');
        if (loginBtn) loginBtn.classList.add('hidden');
        if (registerBtn) registerBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
    } else {
        userNameDisplay.textContent = 'Account';
        if (loginBtn) loginBtn.classList.remove('hidden');
        if (registerBtn) registerBtn.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }
}

if (authModalCloseBtn) {
    authModalCloseBtn.addEventListener('click', closeAuthModal);
}
if (authModal) {
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });
}

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('productGalleryModal');
    if (!modal || modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeProductGallery();
    if (e.key === 'ArrowLeft') moveGallery(-1);
    if (e.key === 'ArrowRight') moveGallery(1);
    if (e.key === 'Tab') trapGalleryFocus(e);
});

if (loginBtn) {
    loginBtn.addEventListener('click', openLoginModal);
}
if (registerBtn) {
    registerBtn.addEventListener('click', openRegisterModal);
}

if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', () => {
        userDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.add('hidden');
        }
    });
}

// ==================== Mobile Menu ====================
if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ==================== API Calls & Product Rendering ====================
async function fetchCategories() {
    try {
        const res = await fetch(`${API_BASE}/categories`);
        if (!res.ok) throw new Error('Failed to load categories');
        categories = await res.json();
        const honeyCat = categories.find(c => c.name.toLowerCase().includes('honey'));
        if (honeyCat) honeyCategoryId = honeyCat.id;

        if (categoryFiltersDiv) {
            categoryFiltersDiv.innerHTML = '<button class="category-filter bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 shadow-sm" data-category-id="all">All Products</button>';
            categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.className = 'category-filter bg-white text-amber-700 px-5 py-2.5 rounded-xl font-medium hover:bg-amber-600 hover:text-white transition-all duration-200 shadow-sm border border-amber-200';
                btn.setAttribute('data-category-id', cat.id);
                btn.textContent = cat.name;
                categoryFiltersDiv.appendChild(btn);
            });

            document.querySelectorAll('.category-filter').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.category-filter').forEach(b => {
                        b.classList.remove('bg-amber-600', 'text-white');
                        b.classList.add('bg-white', 'text-amber-700', 'border', 'border-amber-200');
                    });
                    btn.classList.remove('bg-white', 'text-amber-700', 'border', 'border-amber-200');
                    btn.classList.add('bg-amber-600', 'text-white');

                    const catId = btn.getAttribute('data-category-id');
                    selectedCategoryId = catId === 'all' ? null : parseInt(catId, 10);
                    dryVisibleCount = DRY_PRODUCTS_PAGE_SIZE;
                    honeyVisibleCount = HONEY_PRODUCTS_PAGE_SIZE;
                    applyFiltersAndRender();
                });
            });
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function fetchProducts() {
    renderProductSkeletons();
    try {
        const res = await fetch(`${API_BASE}/products`);
        if (!res.ok) throw new Error('Failed to load products');
        const rawProducts = await res.json();
        allProducts = Array.isArray(rawProducts) ? rawProducts.map((prod) => normalizeProduct(prod)) : [];
        dryVisibleCount = DRY_PRODUCTS_PAGE_SIZE;
        honeyVisibleCount = HONEY_PRODUCTS_PAGE_SIZE;
        applyFiltersAndRender();
    } catch (err) {
        console.error('Product fetch error:', err);
        if (ENABLE_STATIC_PRODUCT_FALLBACK) {
            showToast('Using static products (backend unavailable)', 'info');
            restoreStaticProductMarkup();
            if (!initialDryMarkup && !initialHoneyMarkup && !initialHoneyProductsMarkup) {
                renderProductsError('Unable to refresh products from backend.');
            }
            return;
        }

        showToast('Backend unavailable. Please try again later.', 'error');
        renderProductsError('Unable to load products right now. Please try again later.');
    }
}

function renderProductsBasedOnPage() {
    applyFiltersAndRender();
}

function applySort(products) {
    const items = Array.isArray(products) ? [...products] : [];
    switch (selectedSort) {
        case 'name-asc':
            return items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        case 'name-desc':
            return items.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
        case 'price-asc':
            return items.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        case 'price-desc':
            return items.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        case 'stock-desc':
            return items.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
        case 'featured':
        default:
            return items;
    }
}

function splitProductsBySection(products) {
    if (!honeyCategoryId) {
        return { honey: [], dry: products };
    }
    return {
        honey: products.filter((p) => Number(p.categoryId) === Number(honeyCategoryId)),
        dry: products.filter((p) => Number(p.categoryId) !== Number(honeyCategoryId))
    };
}

function renderEmptyState(container, message) {
    if (!container) return;
    container.innerHTML = `
        <div class="col-span-full text-center py-12">
            <p class="text-amber-700 font-medium">${message}</p>
        </div>
    `;
}

function updateResultsSummary() {
    const summary = document.getElementById('resultsSummary');
    if (!summary) return;

    const total = filteredDryProducts.length + filteredHoneyProducts.length;
    if (!allProducts.length) {
        summary.textContent = '';
        return;
    }

    const categoryLabel = selectedCategoryId ? ` in category` : '';
    const queryLabel = currentSearchQuery ? ` for "${currentSearchQuery}"` : '';
    summary.textContent = `${total} product${total === 1 ? '' : 's'}${queryLabel}${categoryLabel}`;
}

function toggleLoadMoreButtons() {
    const dryBtn = document.getElementById('dryFruitsLoadMore');
    const honeyBtn = document.getElementById('honeyLoadMore');
    const honeyProductsBtn = document.getElementById('honeyProductsLoadMore');

    if (dryBtn) {
        dryBtn.classList.toggle('hidden', filteredDryProducts.length <= dryVisibleCount);
    }

    if (honeyBtn) {
        honeyBtn.classList.toggle('hidden', filteredHoneyProducts.length <= honeyVisibleCount);
    }

    if (honeyProductsBtn) {
        honeyProductsBtn.classList.toggle('hidden', filteredHoneyProducts.length <= honeyVisibleCount);
    }
}

function renderProductGrids() {
    if (!allProducts.length) {
        renderEmptyState(dryFruitsGrid, 'No products available right now.');
        if (honeyGrid) renderEmptyState(honeyGrid, 'No honey products available right now.');
        if (honeyProductsGrid) renderEmptyState(honeyProductsGrid, 'No honey products available right now.');
        return;
    }

    const dryVisible = filteredDryProducts.slice(0, dryVisibleCount);
    const honeyVisible = filteredHoneyProducts.slice(0, honeyVisibleCount);

    if (dryFruitsGrid) {
        dryFruitsGrid.innerHTML = dryVisible.length
            ? dryVisible.map((prod) => createProductCard(prod)).join('')
            : `<div class="col-span-full text-center py-12"><p class="text-amber-700 font-medium">No dry fruits matched your filters.</p></div>`;
    }

    if (honeyGrid) {
        honeyGrid.innerHTML = honeyVisible.length
            ? honeyVisible.map((prod) => createProductCard(prod)).join('')
            : `<div class="col-span-full text-center py-12"><p class="text-amber-700 font-medium">No honey products matched your filters.</p></div>`;
    }

    if (honeyProductsGrid) {
        honeyProductsGrid.innerHTML = honeyVisible.length
            ? honeyVisible.map((prod) => createProductCard(prod)).join('')
            : `<div class="col-span-full text-center py-12"><p class="text-amber-700 font-medium">No honey products matched your filters.</p></div>`;
    }

    toggleLoadMoreButtons();
    attachAddToCartListeners();
    attachProductGalleryListeners();
}

function applyFiltersAndRender() {
    const query = String(currentSearchQuery || '').trim().toLowerCase();
    let products = [...allProducts];

    if (selectedCategoryId) {
        products = products.filter((p) => Number(p.categoryId) === Number(selectedCategoryId));
    }

    if (query) {
        products = products.filter((p) =>
            String(p.name || '').toLowerCase().includes(query) ||
            String(p.shortDescription || p.description || '').toLowerCase().includes(query)
        );
    }

    products = applySort(products);
    const split = splitProductsBySection(products);
    filteredDryProducts = split.dry;
    filteredHoneyProducts = split.honey;

    updateResultsSummary();
    renderProductGrids();
}

function createProductCard(product) {
    const normalized = normalizeProduct(product);
    const imageFromApi = normalized.images.find(img => img.isPrimary)?.url || normalized.images[0]?.url || PRODUCT_IMAGE_FALLBACK;
    const safeName = normalized.name;
    const displayPrice = Number(normalized.price || 0).toFixed(2);
    const lowStock = Number(normalized.stock || 0) > 0 && Number(normalized.stock || 0) < 10;
    const rating = normalized.rating;
    const reviewCount = normalized.reviewCount;
    const media = imageFromApi
        ? `<img src="${imageFromApi}" alt="${safeName}" loading="lazy" decoding="async" class="h-64 w-full object-cover">`
        : `
            <div class="h-64 bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <div class="text-center">
                    <div class="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm mx-auto mb-3 flex items-center justify-center border-2 border-white">
                        <span class="text-white font-bold text-2xl">${safeName.substring(0,2).toUpperCase()}</span>
                    </div>
                    <span class="text-white font-medium drop-shadow-md">${safeName}</span>
                </div>
            </div>
        `;

    return `
        <div class="bg-white rounded-2xl shadow-md overflow-hidden card-hover border border-amber-200 transform transition-all duration-300 hover:shadow-xl cursor-pointer product-card" data-product-id="${normalized.id}">
            <div class="relative overflow-hidden product-gallery-trigger" data-product-id="${normalized.id}" aria-label="Open ${safeName} gallery">
                ${media}
                ${lowStock ? '<span class="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">LOW STOCK</span>' : ''}
                <button type="button" class="absolute left-4 bottom-4 bg-white/90 text-amber-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow product-gallery-trigger" data-product-id="${normalized.id}">
                    View Gallery
                </button>
            </div>
            <div class="p-6">
                <h3 class="font-bold text-xl text-amber-900 line-clamp-1 leading-tight mb-2">${safeName}</h3>
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-100 px-2 py-1">
                        <span class="inline-flex items-center text-amber-500">
                            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                        </span>
                        <span class="text-xs font-semibold text-amber-800">${rating.toFixed(1)}</span>
                    </div>
                    <div class="text-[11px] text-amber-600">${reviewCount} verified reviews</div>
                </div>
                <div class="flex items-center mb-3">
                    <span class="text-3xl font-bold text-amber-600">$${displayPrice}</span>
                </div>
                <p class="text-amber-700 text-sm mb-4 line-clamp-2">${normalized.shortDescription || 'Pure natural product from our collection.'}</p>
                <div class="grid grid-cols-2 gap-3">
                    <button data-product-id="${normalized.id}" class="add-to-cart w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 transition-colors duration-200 transform hover:scale-105">
                        Add to Cart
                    </button>
                    <button data-product-id="${normalized.id}" class="order-now w-full border-2 border-amber-600 text-amber-600 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors duration-200">
                        Order Now
                    </button>
                </div>
            </div>
        </div>
    `;
}

function getProductGalleryImages(product) {
    const normalized = normalizeProduct(product);
    const imageList = normalized.images;
    const urls = imageList
        .map((img) => String(img?.url || '').trim())
        .filter(Boolean);

    if (!urls.length) {
        return [PRODUCT_IMAGE_FALLBACK];
    }

    return [...new Set(urls)];
}

function renderGalleryModal() {
    let modal = document.getElementById('productGalleryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'productGalleryModal';
        modal.className = 'hidden fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm p-3 sm:p-6';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'galleryTitle');
        modal.setAttribute('aria-describedby', 'galleryDescription');
        modal.innerHTML = `
            <div class="h-full w-full flex items-center justify-center">
                <div id="galleryDialogPanel" class="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden" tabindex="-1">
                    <div class="grid grid-cols-1 lg:grid-cols-3">
                        <div class="lg:col-span-2 bg-amber-50">
                            <div class="relative">
                                <div id="galleryImageLoading" class="absolute inset-0 flex items-center justify-center bg-amber-50 z-10">
                                    <div class="w-10 h-10 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin"></div>
                                </div>
                                <img id="galleryMainImage" src="" alt="Product image" class="w-full h-[300px] sm:h-[480px] object-cover">
                                <button id="galleryPrevBtn" type="button" aria-label="Previous image" class="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 text-amber-900 w-10 h-10 rounded-full shadow hover:bg-white">
                                    &lsaquo;
                                </button>
                                <button id="galleryNextBtn" type="button" aria-label="Next image" class="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 text-amber-900 w-10 h-10 rounded-full shadow hover:bg-white">
                                    &rsaquo;
                                </button>
                            </div>
                            <div id="galleryThumbs" class="p-4 flex gap-2 overflow-x-auto bg-white border-t border-amber-100"></div>
                        </div>
                        <div class="p-5 sm:p-6">
                            <div class="flex items-start justify-between gap-4">
                                <h3 id="galleryTitle" class="text-2xl font-bold text-amber-900"></h3>
                                <button id="galleryCloseBtn" type="button" aria-label="Close gallery" class="text-amber-700 hover:text-amber-900 text-2xl leading-none">&times;</button>
                            </div>
                            <p id="galleryPrice" class="text-3xl font-bold text-amber-600 mt-2"></p>
                            <p id="galleryDescription" class="text-amber-700 mt-4 leading-relaxed"></p>
                            <div class="mt-6 grid grid-cols-2 gap-3">
                                <button id="galleryAddToCartBtn" type="button" class="w-full bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 transition-colors">Add to Cart</button>
                                <button id="galleryOrderNowBtn" type="button" class="w-full border-2 border-amber-600 text-amber-700 py-3 rounded-xl font-semibold hover:bg-amber-50 transition-colors">Order Now</button>
                            </div>
                            <div class="mt-6 border-t border-amber-100 pt-4">
                                <div class="flex items-center justify-between mb-2">
                                    <p class="text-sm font-semibold text-amber-900">Customer Reviews</p>
                                    <span id="galleryReviewMeta" class="text-xs text-amber-700"></span>
                                </div>
                                <div id="galleryReviewsList" class="space-y-2 max-h-40 overflow-y-auto pr-1"></div>
                                <div id="galleryReviewFormWrap" class="mt-3">
                                    <div class="grid grid-cols-1 gap-2">
                                        <select id="galleryReviewRating" class="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500">
                                            <option value="5">5 - Excellent</option>
                                            <option value="4">4 - Very Good</option>
                                            <option value="3">3 - Good</option>
                                            <option value="2">2 - Fair</option>
                                            <option value="1">1 - Poor</option>
                                        </select>
                                        <textarea id="galleryReviewComment" rows="2" class="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500" placeholder="Write your review"></textarea>
                                        <button id="galleryReviewSubmit" type="button" class="w-full bg-amber-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-800 transition-colors">Submit Review</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeProductGallery();
        });
        document.getElementById('galleryCloseBtn')?.addEventListener('click', closeProductGallery);
        document.getElementById('galleryPrevBtn')?.addEventListener('click', () => moveGallery(-1));
        document.getElementById('galleryNextBtn')?.addEventListener('click', () => moveGallery(1));
        const mainImage = document.getElementById('galleryMainImage');
        mainImage?.addEventListener('load', () => {
            const loader = document.getElementById('galleryImageLoading');
            if (loader) loader.classList.add('hidden');
        });
        mainImage?.addEventListener('error', () => {
            const loader = document.getElementById('galleryImageLoading');
            if (loader) loader.classList.add('hidden');
            if (mainImage.src !== PRODUCT_IMAGE_FALLBACK) {
                mainImage.src = PRODUCT_IMAGE_FALLBACK;
            }
        });
        mainImage?.addEventListener('touchstart', (e) => {
            if (!e.touches?.length) return;
            galleryTouchStartX = e.touches[0].clientX;
        }, { passive: true });
        mainImage?.addEventListener('touchend', (e) => {
            if (!e.changedTouches?.length) return;
            const deltaX = e.changedTouches[0].clientX - galleryTouchStartX;
            if (Math.abs(deltaX) < 40) return;
            if (deltaX > 0) moveGallery(-1);
            else moveGallery(1);
        }, { passive: true });
        document.getElementById('galleryAddToCartBtn')?.addEventListener('click', async () => {
            if (!activeGalleryProduct) return;
            await handleGalleryAddToCart(activeGalleryProduct.id);
        });
        document.getElementById('galleryOrderNowBtn')?.addEventListener('click', async () => {
            if (!activeGalleryProduct) return;
            await handleGalleryOrderNow(activeGalleryProduct.id);
        });
        document.getElementById('galleryReviewSubmit')?.addEventListener('click', async () => {
            await handleGalleryReviewSubmit();
        });
    }
    return modal;
}

function renderGalleryReviews() {
    const list = document.getElementById('galleryReviewsList');
    const meta = document.getElementById('galleryReviewMeta');
    const formWrap = document.getElementById('galleryReviewFormWrap');
    if (!list || !meta || !formWrap) return;

    const reviews = Array.isArray(activeProductReviews) ? activeProductReviews : [];
    const avg = reviews.length
        ? (reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
        : '0.0';
    meta.textContent = `${avg} (${reviews.length})`;

    if (!reviews.length) {
        list.innerHTML = '<p class="text-xs text-amber-700">No reviews yet. Be the first to review.</p>';
    } else {
        list.innerHTML = reviews.map((r) => {
            const name = String(r?.user?.name || 'Customer');
            const rating = Number(r?.rating || 0);
            const stars = '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(Math.max(0, 5 - Math.min(5, rating)));
            const comment = String(r?.comment || '').trim();
            return `
                <div class="rounded-lg border border-amber-100 bg-amber-50 p-2">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-xs font-semibold text-amber-900">${name}</p>
                        <p class="text-xs text-amber-700">${stars}</p>
                    </div>
                    ${comment ? `<p class="text-xs text-amber-800 mt-1">${comment}</p>` : ''}
                </div>
            `;
        }).join('');
    }

    formWrap.style.display = isLoggedIn() ? '' : 'none';
    if (!isLoggedIn()) {
        list.insertAdjacentHTML('beforeend', '<p class="text-xs text-amber-700 mt-2">Login to add your review.</p>');
    }
}

async function loadProductReviews(productId) {
    try {
        const res = await fetch(`${API_BASE}/products/${productId}/reviews`);
        if (!res.ok) throw new Error('Failed to load reviews');
        const data = await res.json();
        activeProductReviews = Array.isArray(data) ? data : [];
    } catch (e) {
        activeProductReviews = [];
    }
    renderGalleryReviews();
}

async function handleGalleryReviewSubmit() {
    if (!activeGalleryProduct) return;
    if (!isLoggedIn()) {
        closeProductGallery();
        openLoginModal();
        showToast('Please log in to submit a review', 'info');
        return;
    }

    const ratingEl = document.getElementById('galleryReviewRating');
    const commentEl = document.getElementById('galleryReviewComment');
    const rating = Number(ratingEl?.value || 5);
    const comment = String(commentEl?.value || '').trim();

    try {
        const res = await fetch(`${API_BASE}/products/${activeGalleryProduct.id}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders(),
            },
            body: JSON.stringify({ rating, comment }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Failed to submit review');

        showToast('Review submitted', 'success');
        if (commentEl) commentEl.value = '';
        await loadProductReviews(activeGalleryProduct.id);

        const reviews = Array.isArray(activeProductReviews) ? activeProductReviews : [];
        const reviewCount = reviews.length;
        const avgRating = reviewCount
            ? Number((reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewCount).toFixed(1))
            : 0;

        allProducts = allProducts.map((p) => (
            Number(p.id) === Number(activeGalleryProduct.id)
                ? { ...p, rating: avgRating, reviewCount }
                : p
        ));
        activeGalleryProduct = { ...activeGalleryProduct, rating: avgRating, reviewCount };
        updateProductGalleryView();
        applyFiltersAndRender();
    } catch (err) {
        showToast(err.message || 'Failed to submit review', 'error');
    }
}

function updateProductGalleryView() {
    const modal = document.getElementById('productGalleryModal');
    if (!modal || !activeGalleryProduct || !activeGalleryImages.length) return;

    const mainImage = document.getElementById('galleryMainImage');
    const title = document.getElementById('galleryTitle');
    const price = document.getElementById('galleryPrice');
    const description = document.getElementById('galleryDescription');
    const thumbs = document.getElementById('galleryThumbs');
    const loader = document.getElementById('galleryImageLoading');

    if (loader) loader.classList.remove('hidden');
    mainImage.src = activeGalleryImages[activeGalleryIndex];
    title.textContent = String(activeGalleryProduct.name || 'Product');
    price.textContent = `$${Number(activeGalleryProduct.price || 0).toFixed(2)}`;
    description.textContent = String(activeGalleryProduct.shortDescription || activeGalleryProduct.description || 'Premium natural product from our collection.');
    mainImage.alt = `${title.textContent} image ${activeGalleryIndex + 1} of ${activeGalleryImages.length}`;

    thumbs.innerHTML = activeGalleryImages.map((url, idx) => `
        <button type="button" aria-label="Show image ${idx + 1}" aria-current="${idx === activeGalleryIndex ? 'true' : 'false'}" class="shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${idx === activeGalleryIndex ? 'border-amber-600' : 'border-transparent'}" data-gallery-index="${idx}">
            <img src="${url}" alt="Thumbnail ${idx + 1}" class="w-full h-full object-cover">
        </button>
    `).join('');

    thumbs.querySelectorAll('[data-gallery-index]').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeGalleryIndex = Number(btn.getAttribute('data-gallery-index')) || 0;
            updateProductGalleryView();
        });
    });
}

function moveGallery(step) {
    if (!activeGalleryImages.length) return;
    const next = (activeGalleryIndex + step + activeGalleryImages.length) % activeGalleryImages.length;
    activeGalleryIndex = next;
    updateProductGalleryView();
}

function openProductGallery(productId) {
    const product = allProducts.find((p) => Number(p.id) === Number(productId));
    if (!product) return;

    activeGalleryProduct = normalizeProduct(product);
    activeGalleryImages = getProductGalleryImages(product);
    activeGalleryIndex = 0;
    galleryLastFocusedElement = document.activeElement;

    const modal = renderGalleryModal();
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateProductGalleryView();
    loadProductReviews(activeGalleryProduct.id);
    const closeBtn = document.getElementById('galleryCloseBtn');
    if (closeBtn) closeBtn.focus();
}

function closeProductGallery() {
    const modal = document.getElementById('productGalleryModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    if (galleryLastFocusedElement && typeof galleryLastFocusedElement.focus === 'function') {
        galleryLastFocusedElement.focus();
    }
    galleryLastFocusedElement = null;
}

function getGalleryFocusableElements(modal) {
    const selector = [
        'button:not([disabled])',
        'a[href]',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    return Array.from(modal.querySelectorAll(selector))
        .filter((el) => !el.hasAttribute('hidden') && el.offsetParent !== null);
}

function trapGalleryFocus(e) {
    const modal = document.getElementById('productGalleryModal');
    if (!modal || modal.classList.contains('hidden')) return;
    const focusable = getGalleryFocusableElements(modal);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
    }
}

function attachProductGalleryListeners() {
    document.querySelectorAll('.product-card').forEach((card) => {
        card.removeEventListener('click', handleProductCardClick);
        card.addEventListener('click', handleProductCardClick);
    });
}

function handleProductCardClick(e) {
    if (e.target.closest('.add-to-cart, .order-now')) return;
    const card = e.currentTarget;
    const productId = Number(card.getAttribute('data-product-id'));
    if (!productId) return;
    openProductGallery(productId);
}

async function handleGalleryAddToCart(productId) {
    if (!isLoggedIn()) {
        pendingAddToCartProductId = productId;
        closeProductGallery();
        openLoginModal();
        showToast('Please log in to add items to cart', 'info');
        return;
    }
    try {
        await addToCart(productId);
    } catch (err) {
        showToast(err.message || 'Failed to add to cart', 'error');
    }
}

async function handleGalleryOrderNow(productId) {
    closeProductGallery();
    if (!isLoggedIn()) {
        pendingOrderProductId = productId;
        openLoginModal();
        showToast('Please log in to order', 'info');
        return;
    }
    await orderProduct(productId, 1);
}

async function addToCart(productId) {
    const res = await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders()
        },
        body: JSON.stringify({ productId, quantity: 1 })
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Failed to add to cart');
    await fetchCart();
    showToast('Added to cart!', 'success');
}

function attachAddToCartListeners() {
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        // Remove existing listener to avoid duplicates
        btn.removeEventListener('click', handleAddToCart);
        btn.addEventListener('click', handleAddToCart);
    });
    // attach order-now listeners
    document.querySelectorAll('.order-now').forEach(btn => {
        btn.removeEventListener('click', handleOrderNow);
        btn.addEventListener('click', handleOrderNow);
    });
}

async function handleAddToCart(e) {
    const clickedBtn = e.currentTarget;
    const card = clickedBtn.closest('[data-product-id]');
    const productId = Number(clickedBtn.dataset.productId || card?.dataset.productId);
    if (!productId) {
        showToast('Product not found. Please refresh and try again.', 'error');
        return;
    }

    if (!isLoggedIn()) {
        pendingAddToCartProductId = productId;
        openLoginModal();
        showToast('Please log in to add items to cart', 'info');
        return;
    }

    try {
        await addToCart(productId);
    } catch (err) {
        showToast(err.message, 'error');
        if (err.message.includes('401') || err.message.includes('token')) {
            clearSession();
            openLoginModal();
        }
    }
}

let pendingOrderProductId = null;

async function handleOrderNow(e) {
    const clickedBtn = e.currentTarget;
    const card = clickedBtn.closest('[data-product-id]');
    const productId = Number(clickedBtn.dataset.productId || card?.dataset.productId);
    if (!productId) {
        showToast('Product not found. Please refresh and try again.', 'error');
        return;
    }

    if (!isLoggedIn()) {
        pendingOrderProductId = productId;
        openLoginModal();
        showToast('Please log in to order', 'info');
        return;
    }

    await orderProduct(productId, 1);
}

async function orderProduct(productId, quantity = 1) {
    try {
        closeProductGallery();
        const shippingAddress = await showShippingForm({ name: currentUser?.name || '' });
        if (!shippingAddress) {
            showToast('Order cancelled. Shipping details are required.', 'warning');
            return;
        }

        const orderRes = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders()
            },
            body: JSON.stringify({ productId, quantity, shippingAddress, paymentMeta: { method: 'online' } })
        });

        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.message || 'Failed to place order');

        showToast(`Order placed successfully! Order #${orderData.id || ''}`, 'success');
    } catch (err) {
        showToast(err.message || 'Failed to place order', 'error');
    }
}

async function fetchCart() {
    if (!cartCountSpan) return;
    if (!isLoggedIn()) {
        cartCountSpan.textContent = '(0)';
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/cart`, { headers: authHeaders() });
        if (res.status === 401) {
            clearSession();
            showToast('Session expired. Please log in again.', 'info');
            throw new Error('Session expired');
        }
        if (!res.ok) throw new Error('Failed to load cart');
        const cart = await res.json();
        const totalItems = cart.items ? cart.items.reduce((sum, item) => sum + item.quantity, 0) : 0;
        cartCountSpan.textContent = `(${totalItems})`;
    } catch (err) {
        console.error(err);
        cartCountSpan.textContent = '(0)';
    }
}

function filterProducts(categoryId) {
    selectedCategoryId = categoryId ? Number(categoryId) : null;
    dryVisibleCount = DRY_PRODUCTS_PAGE_SIZE;
    honeyVisibleCount = HONEY_PRODUCTS_PAGE_SIZE;
    applyFiltersAndRender();
}

function searchProducts(query) {
    currentSearchQuery = String(query || '');
    dryVisibleCount = DRY_PRODUCTS_PAGE_SIZE;
    honeyVisibleCount = HONEY_PRODUCTS_PAGE_SIZE;
    applyFiltersAndRender();
}

async function placeOrderFromCart() {
    if (!isLoggedIn()) {
        openLoginModal();
        showToast('Please log in to place an order', 'info');
        return;
    }

    try {
        closeProductGallery();
        const cartRes = await fetch(`${API_BASE}/cart`, { headers: authHeaders() });
        const cartData = await cartRes.json();
        if (!cartRes.ok) throw new Error(cartData.message || 'Failed to load cart');
        if (!cartData.items || cartData.items.length === 0) {
            showToast('Your cart is empty.', 'warning');
            return;
        }

        // Collect shipping details using modal form
        const shippingAddress = await showShippingForm({ name: currentUser?.name || '' });
        if (!shippingAddress) {
            showToast('Order cancelled. Shipping details are required.', 'warning');
            return;
        }

        const orderRes = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders()
            },
            body: JSON.stringify({
                shippingAddress,
                paymentMeta: { method: 'manual' }
            })
        });
        const orderData = await orderRes.json();
        if (!orderRes.ok) throw new Error(orderData.message || 'Failed to place order');

        showToast(`Order placed successfully! Order #${orderData.id || ''}`, 'success');
        await fetchCart();
    } catch (err) {
        showToast(err.message || 'Failed to place order', 'error');
    }
}

// ==================== Cart Modal UI ====================
async function removeCartItem(cartItemId) {
    try {
        const res = await fetch(`${API_BASE}/cart/${cartItemId}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        if (!res.ok) throw new Error('Failed to remove item');
        await fetchCart();
        // If modal is open, refresh it
        const modal = document.getElementById('cartModal');
        if (modal && modal.dataset.open === 'true') await openCartView();
        showToast('Item removed from cart', 'success');
    } catch (err) {
        showToast(err.message || 'Failed to remove item', 'error');
    }
}

function buildCartItemsHTML(items) {
    if (!items || items.length === 0) return '<p class="p-4">Your cart is empty.</p>';
    return `
        <div class="divide-y">
            ${items.map(it => {
                const product = normalizeProduct(it.product || {});
                const name = product.name;
                const price = product.price;
                const subtotal = (Number(price) * (it.quantity || 1)).toFixed(2);
                return `
                    <div class="p-4 flex items-center justify-between" data-cart-id="${it.id}">
                        <div>
                            <div class="font-semibold">${name}</div>
                            <div class="text-sm text-gray-500">Qty: ${it.quantity} • $${price}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold">$${subtotal}</div>
                            <button data-cart-id="${it.id}" class="remove-cart-item mt-2 text-sm text-red-600">Remove</button>
                        </div>
                    </div>`;
            }).join('')}
        </div>
    `;
}

function showCartModal(cartData) {
    // ensure only one modal
    let modal = document.getElementById('cartModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'cartModal';
    modal.dataset.open = 'true';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';

    const items = cartData.items || [];
    const total = items.reduce((s, it) => {
        const product = normalizeProduct(it.product || {});
        return s + (Number(product.price || 0) * (it.quantity || 1));
    }, 0).toFixed(2);

    modal.innerHTML = `
        <div class="bg-white w-11/12 max-w-2xl rounded-lg shadow-lg overflow-hidden">
            <div class="p-4 border-b flex items-center justify-between">
                <h3 class="font-bold">Your Cart (${items.length})</h3>
                <div>
                    <button id="closeCartModal" class="text-sm px-3 py-1 bg-gray-100 rounded">Close</button>
                </div>
            </div>
            <div id="cartModalBody" class="p-2 max-h-96 overflow-auto">
                ${buildCartItemsHTML(items)}
            </div>
            <div class="p-4 border-t flex items-center justify-between">
                <div class="font-semibold">Total: $${total}</div>
                <div class="flex gap-2">
                    <button id="checkoutFromModal" class="px-4 py-2 bg-amber-600 text-white rounded">Checkout</button>
                </div>
            </div>
            <div class="px-4 pb-4 pt-2 bg-amber-50 border-t border-amber-100">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-amber-800">
                    <p class="font-medium">Estimated Shipping: 2-5 business days</p>
                    <p class="font-medium">Easy Returns: 7-day replacement policy</p>
                    <p class="font-medium">Secure Payment: Encrypted checkout</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('closeCartModal').addEventListener('click', () => {
        modal.dataset.open = 'false';
        modal.remove();
    });

    document.getElementById('checkoutFromModal').addEventListener('click', async () => {
        modal.dataset.open = 'false';
        modal.remove();
        await placeOrderFromCart();
    });

    // attach remove handlers
    modal.querySelectorAll('.remove-cart-item').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-cart-id');
            if (!id) return;
            await removeCartItem(id);
        });
    });
}

// ==================== Shipping Form Modal ====================
function showShippingForm(initial = {}) {
    return new Promise((resolve) => {
        // remove existing
        const existing = document.getElementById('shippingModal');
        if (existing) existing.remove();
        const existingCart = document.getElementById('cartModal');
        if (existingCart) existingCart.remove();
        const existingGallery = document.getElementById('productGalleryModal');
        if (existingGallery) existingGallery.classList.add('hidden');

        const modal = document.createElement('div');
        modal.id = 'shippingModal';
        modal.className = 'fixed inset-0 z-[140] flex items-center justify-center bg-black/60 backdrop-blur-sm';

        modal.innerHTML = `
            <div class="bg-white w-11/12 max-w-lg rounded-lg shadow-lg overflow-hidden">
                <div class="p-4 border-b flex items-center justify-between">
                    <h3 class="font-bold">Shipping Details</h3>
                    <button id="closeShippingForm" class="text-sm px-3 py-1 bg-gray-100 rounded">Close</button>
                </div>
                <div class="p-4">
                    <div class="mb-3">
                        <label class="block text-sm font-medium mb-1">Full name</label>
                        <input id="ship_name" class="w-full border px-3 py-2 rounded" value="${(initial.name||'').replace(/"/g,'')}">
                    </div>
                    <div class="mb-3">
                        <label class="block text-sm font-medium mb-1">Phone</label>
                        <input id="ship_phone" class="w-full border px-3 py-2 rounded" value="${(initial.phone||'')}">
                    </div>
                    <div class="mb-3">
                        <label class="block text-sm font-medium mb-1">Address</label>
                        <input id="ship_address" class="w-full border px-3 py-2 rounded" value="${(initial.address||'')}">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-sm font-medium mb-1">City</label>
                            <input id="ship_city" class="w-full border px-3 py-2 rounded" value="${(initial.city||'')}">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Postal Code</label>
                            <input id="ship_postal" class="w-full border px-3 py-2 rounded" value="${(initial.postalCode||'')}">
                        </div>
                    </div>
                    <div class="mt-4 flex justify-end gap-2">
                        <button id="cancelShipping" class="px-4 py-2 rounded border">Cancel</button>
                        <button id="submitShipping" class="px-4 py-2 bg-amber-600 text-white rounded">Submit</button>
                    </div>
                    <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p class="text-xs text-amber-800 font-medium">Delivery estimate: 2-5 business days</p>
                        <p class="text-xs text-amber-700 mt-1">Returns: 7-day replacement for damaged/incorrect items.</p>
                        <p class="text-xs text-amber-700 mt-1">Payments are secured with encrypted processing.</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const removeModal = () => { modal.remove(); };

        modal.querySelector('#closeShippingForm').addEventListener('click', () => { removeModal(); resolve(null); });
        modal.querySelector('#cancelShipping').addEventListener('click', () => { removeModal(); resolve(null); });

        modal.querySelector('#submitShipping').addEventListener('click', () => {
            const name = document.getElementById('ship_name').value.trim();
            const phone = document.getElementById('ship_phone').value.trim();
            const address = document.getElementById('ship_address').value.trim();
            const city = document.getElementById('ship_city').value.trim();
            const postalCode = document.getElementById('ship_postal').value.trim();

            if (!name || !phone || !address || !city || !postalCode) {
                showToast('Please fill all shipping fields', 'warning');
                return;
            }

            removeModal();
            resolve({ name, phone, address, city, postalCode });
        });
    });
}

async function openCartView() {
    if (!isLoggedIn()) {
        openLoginModal();
        showToast('Please log in to view your cart', 'info');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/cart`, { headers: authHeaders() });
        if (res.status === 401) {
            clearSession();
            openLoginModal();
            return;
        }
        if (!res.ok) throw new Error('Failed to load cart');
        const data = await res.json();
        if (!data.items || data.items.length === 0) {
                // Close any existing cart modal so UI doesn't show stale item
                const existingModal = document.getElementById('cartModal');
                if (existingModal) {
                existingModal.dataset.open = 'false';
                existingModal.remove();
                }
                showToast('Your cart is empty.', 'warning');
                return;
        }
        showCartModal(data);
    } catch (err) {
        showToast(err.message || 'Failed to load cart', 'error');
    }
}

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) currentUser = JSON.parse(storedUser);
    } catch {
        currentUser = null;
    }

    if (token) {
        if (!currentUser) currentUser = { name: 'Account' };
        updateUIForUser();
    }

    initialDryMarkup = dryFruitsGrid ? dryFruitsGrid.innerHTML : '';
    initialHoneyMarkup = honeyGrid ? honeyGrid.innerHTML : '';
    initialHoneyProductsMarkup = honeyProductsGrid ? honeyProductsGrid.innerHTML : '';

    ensureProductControls();
    ensureLoadMoreButtons();

    await fetchCategories();
    await fetchProducts();
    await fetchCart();
});

if (cartBtn) {
    cartBtn.removeEventListener('click', placeOrderFromCart);
    cartBtn.addEventListener('click', openCartView);
}

// Search event listeners
if (searchBtn && searchInput) {
    const debouncedSearch = debounce((value) => searchProducts(value), 250);
    searchBtn.addEventListener('click', () => searchProducts(searchInput.value));
    searchInput.addEventListener('input', () => debouncedSearch(searchInput.value));
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') searchProducts(searchInput.value);
    });
}

// View All Dry Fruits button
const viewAllBtn = document.getElementById('viewAllDryFruits');
if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
        selectedCategoryId = null;
        currentSearchQuery = '';
        if (searchInput) searchInput.value = '';
        const allFilterBtn = document.querySelector('.category-filter[data-category-id="all"]');
        if (allFilterBtn) allFilterBtn.click();
        else applyFiltersAndRender();
    });
}

// Newsletter (demo)
const newsletterBtn = document.getElementById('newsletterBtn');
if (newsletterBtn) {
    newsletterBtn.addEventListener('click', () => {
        const email = document.getElementById('newsletterEmail').value;
        if (email) showToast(`Subscribed with ${email} (demo)`, 'success');
        else showToast('Please enter an email', 'warning');
    });
}
