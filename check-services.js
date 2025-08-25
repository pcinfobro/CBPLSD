import { connectUsingMongoose } from './config/mongodb.js';
import Service from './models/serviceModel.js';

async function checkServices() {
    try {
        await connectUsingMongoose();
        console.log('✅ Connected to database');

        const serviceCount = await Service.countDocuments();
        console.log(`📊 Total services in database: ${serviceCount}`);

        if (serviceCount === 0) {
            console.log('❌ No services found in database!');
            console.log('📝 Creating sample services...');
            
            const sampleServices = [
                { name: 'WhatsApp', price: 1.5, ltr_short_price: '1.50', ltr_price: '5.00', available: '1' },
                { name: 'Telegram', price: 1.0, ltr_short_price: '1.00', ltr_price: '4.00', available: '1' },
                { name: 'Discord', price: 1.25, ltr_short_price: '1.25', ltr_price: '4.50', available: '1' },
                { name: 'Instagram', price: 2.0, ltr_short_price: '2.00', ltr_price: '7.00', available: '1' },
                { name: 'Facebook', price: 1.75, ltr_short_price: '1.75', ltr_price: '6.00', available: '1' },
            ];

            await Service.insertMany(sampleServices);
            console.log('✅ Sample services created');
        } else {
            console.log('📋 Sample services:');
            const services = await Service.find().limit(10).select('name price ltr_short_price ltr_price available');
            services.forEach(service => {
                console.log(`  - ${service.name}: $${service.ltr_short_price} (3days) / $${service.ltr_price} (30days)`);
            });
        }

        console.log('🚀 Test complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkServices();
