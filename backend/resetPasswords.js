const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
require('dotenv').config();

async function resetPasswords() {
    try {
        console.log('Connecting to scanbite database...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/scanbite');

        const admins = await Admin.find({});
        console.log(`Found ${admins.length} admins.`);

        const defaultPassword = 'admin'; // Just in case, let's reset to plain text 'admin' initially to auto-upgrade, or simply hash it. Let's hash 'admin123'
        const hashedPassword = await bcrypt.hash('admin123', 10);

        for (let admin of admins) {
            admin.password = hashedPassword;
            await admin.save();
            console.log(`[DEBUG] Reset password for ${admin.email} to 'admin123'`);
        }

        console.log('Password reset complete!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetPasswords();
