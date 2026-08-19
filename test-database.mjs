// Quick database connection test
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gfmxvvjqlhrnmidutjwx.supabase.co";
const supabaseKey = "your_removed_credential_here";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabase() {
    try {
        console.log('🔗 Testing database connection...');

        // Test basic connection by checking products
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name')
            .limit(5);

        if (productsError) {
            console.error('❌ Database connection failed:', productsError.message);
            return false;
        }

        console.log('✅ Database connection successful!');
        console.log(`📦 Found ${products.length} products in database`);

        // Test collections
        const { data: collections, error: collectionsError } = await supabase
            .from('collections')
            .select('id, name')
            .limit(3);

        if (!collectionsError) {
            console.log(`📂 Found ${collections.length} collections in database`);
        }

        return true;
    } catch (error) {
        console.error('❌ Database test failed:', error.message);
        return false;
    }
}

testDatabase().then(success => {
    if (success) {
        console.log('🎉 All database tests passed!');
    } else {
        console.log('💥 Database tests failed!');
        process.exit(1);
    }
});