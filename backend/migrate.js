const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const MenuItem = require('./models/MenuItem');
const Order = require('./models/Order');
const Table = require('./models/Table');

async function migrate() {
    console.log('Connecting to old DB: restaurantapp');
    const oldConn = await mongoose.createConnection('mongodb://localhost:27017/restaurantapp').asPromise();

    console.log('Connecting to new DB: scanbite');
    const newConn = await mongoose.createConnection('mongodb://localhost:27017/scanbite').asPromise();

    const OldAdmin = oldConn.model('Admin', Admin.schema);
    const OldMenuItem = oldConn.model('MenuItem', MenuItem.schema);
    const OldOrder = oldConn.model('Order', Order.schema);
    const OldTable = oldConn.model('Table', Table.schema);

    const NewAdmin = newConn.model('Admin', Admin.schema);
    const NewMenuItem = newConn.model('MenuItem', MenuItem.schema);
    const NewOrder = newConn.model('Order', Order.schema);
    const NewTable = newConn.model('Table', Table.schema);

    console.log('Clearing existing data in scanbite DB to avoid duplicates...');
    await NewAdmin.deleteMany({});
    await NewMenuItem.deleteMany({});
    await NewOrder.deleteMany({});
    await NewTable.deleteMany({});

    console.log('Fetching old data...');
    const admins = await OldAdmin.find({});
    const menuItems = await OldMenuItem.find({});
    const orders = await OldOrder.find({});
    const tables = await OldTable.find({});

    console.log(`Copying ${admins.length} admins...`);
    for (let admin of admins) {
        try { await NewAdmin.collection.insertOne(admin.toObject()); } catch (e) { console.log('Skipped duplicate admin:', e.message); }
    }

    console.log(`Copying ${menuItems.length} menu items...`);
    for (let item of menuItems) {
        try { await NewMenuItem.collection.insertOne(item.toObject()); } catch (e) { console.log('Skipped duplicate menu item:', e.message); }
    }

    console.log(`Copying ${orders.length} orders...`);
    for (let order of orders) {
        try { await NewOrder.collection.insertOne(order.toObject()); } catch (e) { console.log('Skipped duplicate order:', e.message); }
    }

    console.log(`Copying ${tables.length} tables...`);
    for (let table of tables) {
        try { await NewTable.collection.insertOne(table.toObject()); } catch (e) { console.log('Skipped duplicate table:', e.message); }
    }

    console.log('Migration complete!');
    process.exit(0);
}

migrate().catch(err => {
    console.error(err);
    process.exit(1);
});
