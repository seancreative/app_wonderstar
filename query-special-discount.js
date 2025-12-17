const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://lfmfzvhonbjgmejrevat.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmbWZ6dmhvbmJqZ21lanJldmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MTYzOTIsImV4cCI6MjA3ODA5MjM5Mn0.wo6tfZYaNDrbwmFawshJVinvfQpc4r_zMu-6ROLeqw4'
);

(async () => {
  const { data, error } = await supabase
    .from('shop_products')
    .select('product_id, name, special_discount, base_price, is_active')
    .eq('special_discount', true)
    .order('name');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No products with special_discount enabled found.');
    return;
  }
  
  console.log('\n=== PRODUCTS WITH SPECIAL DISCOUNT ENABLED ===\n');
  data.forEach((product, index) => {
    const num = index + 1;
    console.log(num + '. ' + product.name);
    console.log('   Product ID: ' + product.product_id);
    console.log('   Base Price: RM' + product.base_price.toFixed(2));
    console.log('   Discounted Price: RM' + (product.base_price - 5).toFixed(2));
    console.log('   Status: ' + (product.is_active ? 'Active' : 'Inactive'));
    console.log('');
  });
  
  console.log('Total: ' + data.length + ' product(s) with special discount enabled\n');
})();
