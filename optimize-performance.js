import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to remove excessive console.log statements from files
function removeConsoleStatements(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Remove console.log statements but keep error logging
        const optimizedContent = content
            .replace(/console\.log\("Initializing page\.\.\."\);?\s*/g, '')
            .replace(/console\.log\("Page initialization completed successfully"\);?\s*/g, '')
            .replace(/console\.log\(`Making API call to: \${url}`\);?\s*/g, '')
            .replace(/console\.log\(`Response status: \${response\.status}`\);?\s*/g, '')
            .replace(/console\.log\(\s*["']Response:["'][\s\S]*?\);?\s*/g, '')
            .replace(/console\.log\("Loading existing orders\.\.\."\);?\s*/g, '')
            .replace(/console\.log\("API response:", response\);?\s*/g, '')
            .replace(/console\.log\("Raw response data:", JSON\.stringify\(response, null, 2\)\);?\s*/g, '')
            .replace(/console\.log\("Orders loaded:", response\.orders\);?\s*/g, '')
            .replace(/console\.log\("First order structure:", response\.orders\[0\]\);?\s*/g, '')
            .replace(/console\.log\("First order keys:", Object\.keys\(response\.orders\[0\]\)\);?\s*/g, '')
            .replace(/console\.log\(`Order \${index} SMS fields:`,[\s\S]*?\);?\s*/g, '')
            .replace(/console\.log\("API response not successful:", response\);?\s*/g, '')
            .replace(/console\.log\(`Auto-checking SMS for pending order: \${orderId}`\);?\s*/g, '')
            .replace(/console\.log\(\s*["']Updating orders table with:["'][\s\S]*?\);?\s*/g, '')
            .replace(/console\.log\("Orders data structure:", orders\);?\s*/g, '')
            .replace(/console\.log\("Table body element found:", tbody\);?\s*/g, '')
            .replace(/console\.log\("Order data:", order\);?\s*/g, '')
            .replace(/console\.log\("Order properties:", Object\.keys\(order\)\);?\s*/g, '');
        
        // Only write if content changed
        if (content !== optimizedContent) {
            fs.writeFileSync(filePath, optimizedContent);
            console.log(`✅ Optimized: ${path.basename(filePath)}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error optimizing ${filePath}:`, error.message);
        return false;
    }
}

// Main optimization function
function optimizeApplication() {
    console.log('🚀 Starting performance optimization...\n');
    
    const viewsDir = path.join(__dirname, 'views');
    let optimizedFiles = 0;
    
    // Get all EJS files in views directory
    const ejsFiles = fs.readdirSync(viewsDir)
        .filter(file => file.endsWith('.ejs'))
        .map(file => path.join(viewsDir, file));
    
    console.log(`📁 Found ${ejsFiles.length} EJS files to check\n`);
    
    // Optimize each file
    ejsFiles.forEach(filePath => {
        if (removeConsoleStatements(filePath)) {
            optimizedFiles++;
        }
    });
    
    console.log(`\n✨ Performance optimization complete!`);
    console.log(`📊 Files optimized: ${optimizedFiles}/${ejsFiles.length}`);
    
    // Additional recommendations
    console.log('\n📋 Additional Performance Recommendations:');
    console.log('1. ✅ Removed excessive console.log statements');
    console.log('2. ✅ Optimized database queries with Promise.all');
    console.log('3. ✅ Added MongoDB session store');
    console.log('4. ✅ Implemented user data caching');
    console.log('5. ✅ Enhanced database connection pooling');
    console.log('6. ✅ Optimized auth middleware');
    console.log('7. ✅ Consolidated error handlers');
    
    console.log('\n🏃‍♂️ Your application should now load much faster!');
    console.log('💡 Restart your server to see the improvements.');
}

// Run optimization
optimizeApplication();
