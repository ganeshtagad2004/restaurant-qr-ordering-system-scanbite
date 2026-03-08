const Admin = require('../models/Admin');
const MenuItem = require('../models/MenuItem');
const axios = require('axios');

/* ──────────────────────────────────────────────────────────────
   UNSPLASH API CONFIG
   ──────────────────────────────────────────────────────────── */
const UNSPLASH_KEY = 'MY8Zlpb4msQzs0QV1_IDhZczm1c1zNaS91BA8rn4tdk';
const UNSPLASH_SEARCH = 'https://api.unsplash.com/search/photos';

// Track which photo IDs have already been used → prevents duplicates
const usedPhotoIds = new Set();

/* ──────────────────────────────────────────────────────────────
   CATEGORY FALLBACK IMAGES (verified high-res Unsplash links)
   ──────────────────────────────────────────────────────────── */
const categoryFallback = {
    'Starters': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?w=800&q=80',
    'Soups': 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&q=80',
    'Main Course': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=800&q=80',
    'Breads': 'https://images.unsplash.com/photo-1600628421060-049177a30a47?w=800&q=80',
    'Rice & Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&q=80',
    'South Indian': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=800&q=80',
    'Chaat': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=800&q=80',
    'Thali': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80',
    'Desserts': 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800&q=80',
    'Beverages': 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800&q=80',
};
const DEFAULT_FOOD = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80';

/* ──────────────────────────────────────────────────────────────
   BUILD PRECISE SEARCH QUERY per item
   ──────────────────────────────────────────────────────────── */
function buildQuery(name, category) {
    // Search query format: "<dish name> indian food" (with smart suffixes)
    let suffix = 'indian food';
    if (category === 'Chaat') suffix = 'indian street food';
    else if (category === 'South Indian') suffix = 'south indian food';
    else if (category === 'Desserts') suffix = 'indian dessert sweet';
    else if (category === 'Thali') suffix = 'indian meal dish';
    else if (category === 'Beverages') suffix = 'indian drink beverage';
    else if (category === 'Breads') suffix = 'indian bread tandoor';

    return `${name} ${suffix}`;
}

/* ──────────────────────────────────────────────────────────────
   FETCH IMAGE VIA UNSPLASH SEARCH API (Primary)
   - Fetches up to 10 results per query
   - Picks the first result not already used (uniqueness)
   - High resolution: Regular URL (~1080px)
   ──────────────────────────────────────────────────────────── */
async function fetchFoodImage(name, category = '', id = '') {
    const query = buildQuery(name, category);

    try {
        const response = await axios.get(UNSPLASH_SEARCH, {
            headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
            params: {
                query,
                per_page: 10,            // as requested
                orientation: 'landscape',
                content_filter: 'high',  // ensure no people/cooking scenes
            },
            timeout: 6000,
        });

        const results = response.data?.results;
        if (!results || results.length === 0) {
            return categoryFallback[category] || DEFAULT_FOOD;
        }

        // Pick the first result whose photo ID hasn't been used yet to ensure UNIQUE images
        let chosen = null;
        for (const photo of results) {
            if (!usedPhotoIds.has(photo.id)) {
                chosen = photo;
                usedPhotoIds.add(photo.id);
                break;
            }
        }

        // Edge case: all results already used — use the first anyway
        if (!chosen) chosen = results[0];

        // Return the 'regular' URL (~1080px wide, high quality)
        return chosen.urls.regular;

    } catch (err) {
        console.error(`[fetchFoodImage] Unsplash error for "${name}":`, err.message);
        return categoryFallback[category] || DEFAULT_FOOD;
    }
}

/* ─── PUBLIC: get menu by /api/menu/:slug ──────────────────────── */
exports.getPublicMenuBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        const { t: tableNo } = req.query; // t comes from ?t=1

        if (!slug) {
            return res.status(400).json({ success: false, message: 'Invalid restaurant link. Missing identifier.' });
        }

        // Search STRICTLY by slug for mission isolation
        const admin = await Admin.findOne({ slug: slug.toLowerCase() });

        if (!admin) {
            console.log(`[getPublicMenuBySlug] No restaurant found for slug: "${slug}"`);
            return res.status(404).json({
                success: false,
                message: 'Invalid Menu Link. This restaurant does not exist.'
            });
        }

        // Validate table if tableNo is provided - REQUIREMENT 7: Isolation
        if (tableNo) {
            const Table = require('../models/Table');
            const table = await Table.findOne({ adminId: admin._id, tableNumber: parseInt(tableNo, 10) });
            if (!table) {
                return res.status(404).json({
                    success: false,
                    message: `Table ${tableNo} is not valid for ${admin.restaurantName}. Please scan the correct QR code.`
                });
            }
        }

        const menuItems = await MenuItem.find({ adminId: admin._id, isAvailable: true })
            .sort({ orderCount: -1 });

        // Extract unique categories
        const categories = [...new Set(menuItems.map(item => item.category))];

        return res.status(200).json({
            success: true,
            data: {
                restaurant: {
                    name: admin.restaurantName,
                    logo: admin.logoUrl,
                    theme: admin.themeColor,
                    slug: admin.slug
                },
                categories,
                menuItems
            }
        });
    } catch (err) {
        console.error('[getPublicMenuBySlug]', err);
        return res.status(500).json({ success: false, message: 'Server error while loading menu.' });
    }
};

/* ─── AUTH: get all items for this admin ─────────────────── */
exports.getAllMenu = async (req, res) => {
    try {
        const items = await MenuItem.find({ adminId: req.adminId }).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: items });
    } catch (err) {
        console.error('[getAllMenu]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── PUBLIC: Get Auto Image (Proxy for frontend fallback) ─── */
exports.getAutoImage = async (req, res) => {
    try {
        const { q, category, id } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query required' });
        const imageUrl = await fetchFoodImage(q, category || '', id || '');
        return res.status(200).json({ success: true, imageUrl });
    } catch (err) {
        console.error('[getAutoImage]', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ─── AUTH: add item ─────────────────────────────────────── */
exports.addItem = async (req, res) => {
    try {
        const { name, description, price, category, isVeg } = req.body;

        if (!name || !price || !category) {
            return res.status(400).json({ success: false, message: 'name, price, and category are required.' });
        }

        // Priority: admin uploaded image > Unsplash API fetch
        let imageUrl = req.file ? `/uploads/${req.file.filename}` : '';

        if (!imageUrl) {
            imageUrl = await fetchFoodImage(name, category);
        }

        const item = await MenuItem.create({
            adminId: req.adminId,
            name,
            description: description || '',
            price: parseFloat(price),
            category,
            imageUrl,
            isVeg: isVeg === 'false' ? false : true,
        });

        return res.status(201).json({ success: true, data: item, message: 'Menu item added.' });
    } catch (err) {
        console.error('[addItem]', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: err.message });
        }
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: update item ──────────────────────────────────── */
exports.updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await MenuItem.findOne({ _id: id, adminId: req.adminId });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        const { name, description, price, category, isVeg, isAvailable } = req.body;
        if (name !== undefined) {
            item.name = name;
            // Re-fetch image if name changed and no new upload
            if (!req.file && (!item.imageUrl || item.imageUrl.startsWith('https://'))) {
                item.imageUrl = await fetchFoodImage(name, category || item.category) || item.imageUrl;
            }
        }
        if (description !== undefined) item.description = description;
        if (price !== undefined) item.price = parseFloat(price);
        if (category !== undefined) item.category = category;
        if (isVeg !== undefined) item.isVeg = isVeg === 'false' ? false : true;
        if (isAvailable !== undefined) item.isAvailable = isAvailable === 'false' ? false : true;

        // Priority: admin uploaded image wins
        if (req.file) item.imageUrl = `/uploads/${req.file.filename}`;

        await item.save();
        return res.status(200).json({ success: true, data: item, message: 'Item updated.' });
    } catch (err) {
        console.error('[updateItem]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: delete item ──────────────────────────────────── */
exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await MenuItem.findOneAndDelete({ _id: id, adminId: req.adminId });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }
        return res.status(200).json({ success: true, message: 'Item deleted.' });
    } catch (err) {
        console.error('[deleteItem]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};

/* ─── AUTH: toggle availability ──────────────────────────── */
exports.toggleAvailable = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await MenuItem.findOne({ _id: id, adminId: req.adminId });
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }
        item.isAvailable = !item.isAvailable;
        await item.save();
        return res.status(200).json({
            success: true,
            data: { isAvailable: item.isAvailable },
            message: `Item is now ${item.isAvailable ? 'available' : 'unavailable'}.`,
        });
    } catch (err) {
        console.error('[toggleAvailable]', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
    }
};
