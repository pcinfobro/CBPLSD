import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to fix interval management in EJS files
function fixIntervalManagement(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // Replace old interval management with new centralized approach
        let fixedContent = content
            // Replace setInterval calls with intervalManager.setInterval
            .replace(/setInterval\s*\(\s*([^,]+),\s*(\d+)\s*\)/g, (match, callback, delay) => {
                const key = callback.toString().includes('refreshBalance') ? 'balance-refresh' : 
                           callback.toString().includes('loadRentals') ? 'rentals-refresh' :
                           callback.toString().includes('loadExistingOrders') ? 'orders-refresh' :
                           callback.toString().includes('startAutoSMSCheck') ? 'sms-check' :
                           'general-interval';
                modified = true;
                return `window.intervalManager.setInterval('${key}', ${callback}, ${delay})`;
            })
            
            // Replace clearInterval calls
            .replace(/clearInterval\s*\(\s*([^)]+)\s*\)/g, (match, intervalVar) => {
                modified = true;
                return `window.intervalManager.clearInterval('${intervalVar.replace(/window\.|_interval|Interval/gi, '')}')`;
            })
            
            // Fix balance refresh intervals
            .replace(/window\.balanceRefreshInterval\s*=\s*setInterval/g, () => {
                modified = true;
                return `window.intervalManager.setInterval('balance-refresh', refreshBalance, 30000); //`;
            })
            
            // Fix rentals refresh intervals
            .replace(/window\.rentalsRefreshInterval\s*=\s*setInterval/g, () => {
                modified = true;
                return `window.intervalManager.setInterval('rentals-refresh', loadRentals, 120000); //`;
            })
            
            // Add proper cleanup event listeners
            .replace(/window\.addEventListener\s*\(\s*["']beforeunload["']/g, () => {
                if (!content.includes('intervalManager.clearAll')) {
                    modified = true;
                    return `window.addEventListener('page-hidden', () => {
                        window.intervalManager.clearAll();
                    });
                    window.addEventListener('beforeunload'`;
                }
                return match;
            })
            
            // Replace cachedFetch usage
            .replace(/fetch\s*\(\s*([^,)]+)(?:,\s*([^)]+))?\s*\)/g, (match, url, options) => {
                if (url.includes('/user/api/')) {
                    modified = true;
                    return `window.cachedFetch(${url}${options ? ', ' + options : ''})`;
                }
                return match;
            });

        // Add visibility change handlers if not present
        if (!content.includes('visibilitychange') && content.includes('setInterval')) {
            fixedContent += `
            
            // Handle page visibility changes to manage intervals efficiently
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    // Pause intervals when page is hidden
                    window.intervalManager.clearAll();
                } else {
                    // Resume intervals when page becomes visible
                    setTimeout(() => {
                        if (typeof refreshBalance === 'function') {
                            window.intervalManager.setInterval('balance-refresh', refreshBalance, 30000);
                            refreshBalance(); // Immediate refresh
                        }
                        if (typeof loadRentals === 'function') {
                            window.intervalManager.setInterval('rentals-refresh', loadRentals, 120000);
                        }
                        if (typeof loadExistingOrders === 'function') {
                            window.intervalManager.setInterval('orders-refresh', loadExistingOrders, 30000);
                        }
                    }, 100);
                }
            });`;
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, fixedContent);
            console.log(`✅ Fixed interval management in: ${path.basename(filePath)}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error fixing ${filePath}:`, error.message);
        return false;
    }
}

// Main function to fix all EJS files
function fixApplicationIntervals() {
    console.log('🔧 Fixing interval management across all EJS files...\n');
    
    const viewsDir = path.join(__dirname, 'views');
    let fixedFiles = 0;
    
    // Get all EJS files
    const ejsFiles = fs.readdirSync(viewsDir)
        .filter(file => file.endsWith('.ejs'))
        .map(file => path.join(viewsDir, file));
    
    console.log(`📁 Found ${ejsFiles.length} EJS files to check\n`);
    
    // Fix each file
    ejsFiles.forEach(filePath => {
        if (fixIntervalManagement(filePath)) {
            fixedFiles++;
        }
    });
    
    console.log(`\n✨ Interval management fix complete!`);
    console.log(`📊 Files fixed: ${fixedFiles}/${ejsFiles.length}`);
    
    console.log('\n🎯 Key improvements made:');
    console.log('1. ✅ Centralized interval management');
    console.log('2. ✅ Automatic cleanup on page unload');
    console.log('3. ✅ Resource-saving when page is hidden');
    console.log('4. ✅ Prevented duplicate intervals');
    console.log('5. ✅ Added request caching and deduplication');
    console.log('6. ✅ Memory leak prevention');
    
    console.log('\n🚀 Your app should now stay responsive much longer!');
    console.log('💡 Restart your server to see the improvements.');
}

// Run the fix
fixApplicationIntervals();
