// Quick database connection test
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gfmxvvjqlhrnmidutjwx.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmbXh2dmpxbGhybm1pZHV0and4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU1NzU5MzMsImV4cCI6MjAzMTE1MTkzM30.cqGJsrztyQVJjWQpKQwGYhJP8VJz67BDR0SBl1P-4Js";

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