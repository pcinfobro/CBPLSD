import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to fix cachedFetch issues in EJS files
function fixCachedFetch(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Replace window.cachedFetch with regular fetch temporarily
        const fixedContent = content
            .replace(/window\.cachedFetch\(/g, 'fetch(')
            .replace(/window\.intervalManager\.setInterval\(/g, 'setInterval(')
            .replace(/window\.intervalManager\.clearInterval\(/g, 'clearInterval(');

        if (content !== fixedContent) {
            fs.writeFileSync(filePath, fixedContent);
            console.log(`✅ Fixed: ${path.basename(filePath)}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`❌ Error fixing ${filePath}:`, error.message);
        return false;
    }
}

// Main function
function quickFix() {
    console.log('🔧 Quick fix: Reverting to regular fetch calls...\n');
    
    const viewsDir = path.join(__dirname, 'views');
    let fixedFiles = 0;
    
    // Get all EJS files
    const ejsFiles = fs.readdirSync(viewsDir)
        .filter(file => file.endsWith('.ejs'))
        .map(file => path.join(viewsDir, file));
    
    // Fix each file
    ejsFiles.forEach(filePath => {
        if (fixCachedFetch(filePath)) {
            fixedFiles++;
        }
    });
    
    console.log(`\n✨ Quick fix complete! Fixed ${fixedFiles} files`);
    console.log('🚀 This should resolve the loading issues');
    console.log('💡 Restart your server to see the changes');
}

// Run the quick fix
quickFix();
