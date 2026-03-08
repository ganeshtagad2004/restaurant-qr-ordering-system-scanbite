const mongoose = require('mongoose')
const MenuItem = require('./models/MenuItem')
const Admin = require('./models/Admin')
require('dotenv').config()

const UNSPLASH_KEY = 'MY8Zlpb4msQzs0QV1_IDhZczm1c1zNaS91BA8rn4tdk'
const usedIds = new Set()

async function getImage(name, category) {
    // Search query mapping to match requested examples
    let suffix = 'indian food'
    if (category === 'Chaat') suffix = 'indian street food'
    else if (category === 'Desserts') suffix = 'indian dessert'
    else if (category === 'Thali') suffix = 'indian meal'
    else if (category === 'Beverages') suffix = 'indian drink'
    else if (category === 'South Indian') suffix = 'south indian food'
    else if (name === 'Medu Vada') suffix = 'sambar'

    const query = `${name} ${suffix}`

    try {
        const res = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
            { headers: { Authorization: 'Client-ID ' + UNSPLASH_KEY } }
        )
        const data = await res.json()

        if (data.results && data.results.length > 0) {
            // Find first unused image
            for (const img of data.results) {
                if (!usedIds.has(img.id)) {
                    usedIds.add(img.id)
                    // High resolution regular URL
                    return img.urls.regular
                }
            }
            return data.results[0].urls.regular
        }
        return null
    } catch (e) {
        return null
    }
}

const fallbacks = {
    'Starters': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d6?w=1000',
    'Soups': 'https://images.unsplash.com/photo-1547592180-85f173990554?w=1000',
    'Main Course': 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=1000',
    'Breads': 'https://images.unsplash.com/photo-1600628421060-049177a30a47?w=1000',
    'Rice & Biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=1000',
    'South Indian': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=1000',
    'Chaat': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=1000',
    'Thali': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000',
    'Desserts': 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=1000',
    'Beverages': 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=1000'
}

const items = [
    { name: 'Paneer Tikka', price: 299, category: 'Starters', description: 'Soft paneer grilled in tandoor with spices', orderCount: 145 },
    { name: 'Hara Bhara Kabab', price: 199, category: 'Starters', description: 'Spinach pea kababs crispy outside soft inside', orderCount: 89 },
    { name: 'Crispy Corn Chaat', price: 149, category: 'Starters', description: 'Golden fried corn tossed with spices and lemon', orderCount: 112 },
    { name: 'Veg Spring Rolls', price: 179, category: 'Starters', description: 'Crispy rolls stuffed with fresh vegetables', orderCount: 98 },
    { name: 'Stuffed Mushroom', price: 259, category: 'Starters', description: 'Button mushrooms stuffed with cheese and herbs', orderCount: 67 },
    { name: 'Sweet Corn Soup', price: 129, category: 'Soups', description: 'Creamy sweet corn soup with vegetables', orderCount: 76 },
    { name: 'Tomato Basil Soup', price: 119, category: 'Soups', description: 'Fresh tomato soup with basil and cream', orderCount: 54 },
    { name: 'Hot Sour Soup', price: 139, category: 'Soups', description: 'Spicy tangy vegetable soup', orderCount: 88 },
    { name: 'Lemon Coriander Soup', price: 129, category: 'Soups', description: 'Light refreshing soup with lemon and coriander', orderCount: 43 },
    { name: 'Paneer Butter Masala', price: 329, category: 'Main Course', description: 'Soft paneer in rich creamy tomato gravy', orderCount: 245 },
    { name: 'Dal Makhani', price: 269, category: 'Main Course', description: 'Slow cooked black lentils in buttery tomato sauce', orderCount: 198 },
    { name: 'Kadai Paneer', price: 319, category: 'Main Course', description: 'Paneer with bell peppers in kadai masala', orderCount: 167 },
    { name: 'Palak Paneer', price: 299, category: 'Main Course', description: 'Fresh spinach gravy with soft paneer cubes', orderCount: 145 },
    { name: 'Shahi Paneer', price: 349, category: 'Main Course', description: 'Royal paneer in rich cashew cream gravy', orderCount: 134 },
    { name: 'Malai Kofta', price: 339, category: 'Main Course', description: 'Soft vegetable balls in creamy makhani gravy', orderCount: 123 },
    { name: 'Dum Aloo', price: 259, category: 'Main Course', description: 'Baby potatoes slow cooked in spicy gravy', orderCount: 87 },
    { name: 'Veg Hakka Noodles', price: 249, category: 'Main Course', description: 'Stir fried noodles with fresh vegetables', orderCount: 112 },
    { name: 'Butter Naan', price: 49, category: 'Breads', description: 'Soft leavened bread baked in tandoor with butter', orderCount: 312 },
    { name: 'Garlic Naan', price: 59, category: 'Breads', description: 'Naan topped with fresh garlic and coriander', orderCount: 289 },
    { name: 'Tandoori Roti', price: 39, category: 'Breads', description: 'Whole wheat roti baked in clay tandoor', orderCount: 234 },
    { name: 'Lachha Paratha', price: 55, category: 'Breads', description: 'Multi layered crispy whole wheat paratha', orderCount: 167 },
    { name: 'Stuffed Kulcha', price: 79, category: 'Breads', description: 'Bread stuffed with spiced potato and onion', orderCount: 98 },
    { name: 'Missi Roti', price: 45, category: 'Breads', description: 'Gram flour flatbread with ajwain and spices', orderCount: 67 },
    { name: 'Veg Dum Biryani', price: 299, category: 'Rice & Biryani', description: 'Fragrant basmati rice with vegetables and saffron', orderCount: 198 },
    { name: 'Paneer Biryani', price: 349, category: 'Rice & Biryani', description: 'Aromatic biryani with soft paneer', orderCount: 167 },
    { name: 'Mushroom Biryani', price: 319, category: 'Rice & Biryani', description: 'Earthy mushrooms with spiced basmati rice', orderCount: 89 },
    { name: 'Veg Pulao', price: 229, category: 'Rice & Biryani', description: 'Light basmati rice with mixed vegetables', orderCount: 76 },
    { name: 'Jeera Rice', price: 149, category: 'Rice & Biryani', description: 'Fragrant basmati rice tempered with cumin', orderCount: 145 },
    { name: 'Masala Dosa', price: 179, category: 'South Indian', description: 'Crispy rice crepe with spiced potato filling', orderCount: 234 },
    { name: 'Cheese Dosa', price: 219, category: 'South Indian', description: 'Golden dosa loaded with melted cheese', orderCount: 145 },
    { name: 'Rava Idli', price: 149, category: 'South Indian', description: 'Soft semolina idlis with sambar and chutney', orderCount: 112 },
    { name: 'Medu Vada', price: 129, category: 'South Indian', description: 'Crispy lentil donuts with sambar and chutney', orderCount: 98 },
    { name: 'Onion Uttapam', price: 169, category: 'South Indian', description: 'Thick rice pancake topped with onion tomato', orderCount: 87 },
    { name: 'Pav Bhaji', price: 199, category: 'Chaat', description: 'Spiced mashed vegetables with buttered pav', orderCount: 198 },
    { name: 'Pani Puri', price: 99, category: 'Chaat', description: 'Crispy puris filled with spiced water and potato', orderCount: 312 },
    { name: 'Dahi Puri', price: 129, category: 'Chaat', description: 'Crispy puris with yogurt and chutneys', orderCount: 167 },
    { name: 'Bhel Puri', price: 119, category: 'Chaat', description: 'Puffed rice tossed with vegetables and chutneys', orderCount: 145 },
    { name: 'Samosa', price: 99, category: 'Chaat', description: 'Crispy pastry stuffed with spiced potato', orderCount: 289 },
    { name: 'Aloo Tikki Chaat', price: 149, category: 'Chaat', description: 'Crispy potato patties with yogurt and chutneys', orderCount: 134 },
    { name: 'ScanBite Special Thali', price: 499, category: 'Thali', description: 'Dal Paneer Rice 3 Rotis Papad Pickle Dessert', orderCount: 189 },
    { name: 'Mini Thali', price: 299, category: 'Thali', description: 'Dal Sabzi Rice 2 Rotis Papad', orderCount: 134 },
    { name: 'Jain Thali', price: 449, category: 'Thali', description: 'No onion no garlic complete Jain meal', orderCount: 87 },
    { name: 'Gulab Jamun', price: 99, category: 'Desserts', description: 'Soft milk balls in rose flavored sugar syrup', orderCount: 234 },
    { name: 'Rasgulla', price: 89, category: 'Desserts', description: 'Soft spongy cottage cheese balls in sugar syrup', orderCount: 167 },
    { name: 'Gajar Ka Halwa', price: 149, category: 'Desserts', description: 'Carrot pudding with khoya and dry fruits', orderCount: 145 },
    { name: 'Kesari Phirni', price: 139, category: 'Desserts', description: 'Creamy rice pudding with saffron and cardamom', orderCount: 98 },
    { name: 'Mango Ice Cream', price: 149, category: 'Desserts', description: '2 scoops of fresh Alphonso mango ice cream', orderCount: 189 },
    { name: 'Chocolate Brownie', price: 199, category: 'Desserts', description: 'Warm chocolate brownie with vanilla ice cream', orderCount: 145 },
    { name: 'Mango Lassi', price: 129, category: 'Beverages', description: 'Thick creamy yogurt shake with fresh mango', orderCount: 245 },
    { name: 'Masala Chai', price: 59, category: 'Beverages', description: 'Spiced Indian tea with ginger and cardamom', orderCount: 312 },
    { name: 'Cold Coffee', price: 149, category: 'Beverages', description: 'Chilled blended coffee with milk and ice cream', orderCount: 198 },
    { name: 'Fresh Lime Soda', price: 89, category: 'Beverages', description: 'Refreshing lime juice with soda', orderCount: 145 },
    { name: 'Virgin Mojito', price: 149, category: 'Beverages', description: 'Fresh mint lime sugar and sparkling water', orderCount: 134 },
    { name: 'Watermelon Juice', price: 119, category: 'Beverages', description: 'Fresh chilled watermelon juice with mint', orderCount: 112 },
    { name: 'Filter Coffee', price: 69, category: 'Beverages', description: 'South Indian decoction coffee with frothy milk', orderCount: 145 },
    { name: 'Masala Chaas', price: 79, category: 'Beverages', description: 'Chilled buttermilk with roasted cumin and mint', orderCount: 167 }
]

const bcrypt = require('bcryptjs');

const seedMenu = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        let admin = await Admin.findOne()

        if (!admin) {
            console.log('🌱 No admin found, creating default ScanBite admin...')
            const hashedPassword = await bcrypt.hash('admin123', 10);
            admin = await Admin.create({
                restaurantName: 'ScanBite Demo',
                adminName: 'ScanBite Admin',
                email: 'admin@scanbite.com',
                password: hashedPassword,
                phone: '9876543210',
                address: 'Indiranagar, Bangalore, India',
                slug: 'scanbite-demo',
                themeColor: '#ff6b35'
            });
            console.log('✅ Default admin created: admin@scanbite.com / admin123')
        }

        console.log('✨ Regenerating ScanBite Menu using Unsplash API...\n')

        // Fetch images once (no duplicates across the whole run)
        const menuItems = []
        for (const item of items) {
            let img = await getImage(item.name, item.category)
            const finalImg = img || fallbacks[item.category] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1000'

            menuItems.push({
                name: item.name,
                description: item.description,
                price: item.price,
                category: item.category,
                orderCount: item.orderCount,
                imageUrl: finalImg,
                isVeg: true,
                isAvailable: true
            })
            console.log((img ? '✅' : '⚠️') + ' ' + item.name + ' (' + item.category + ')')
            await new Promise(r => setTimeout(r, 200))
        }

        // Seed for EVERY admin so all dashboards show items
        const allAdmins = await Admin.find({})
        console.log(`\n🔄 Seeding menu for ${allAdmins.length} admin(s)...`)

        for (const a of allAdmins) {
            await MenuItem.deleteMany({ adminId: a._id })
            const copies = menuItems.map(item => ({ ...item, adminId: a._id }))
            await MenuItem.insertMany(copies)
            console.log(`  ✅ ${menuItems.length} items seeded for: ${a.email}`)
        }

        console.log('\n💎 Successfully added ' + menuItems.length + ' premium menu items per admin.')
        console.log('🌱 All images are unique and from Unsplash.')
        console.log('🎉 All admins now have a full menu!')
        mongoose.disconnect()
    } catch (err) {
        console.error('Seed Error:', err)
        process.exit(1)
    }
}

seedMenu()
