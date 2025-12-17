#!/usr/bin/env node

/**
 * Test Instamee Products with DISCOUNT5
 * Simulates the exact cart discount calculation
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load .env file manually
const envContent = readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_ANON_KEY
);

console.log('🧪 Testing DISCOUNT5 with Instamee Products\n');
console.log('='.repeat(60));

async function testInstameeDiscount() {
  // Get DISCOUNT5 voucher
  const { data: voucher } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', 'DISCOUNT5')
    .single();

  console.log('\n📋 DISCOUNT5 Configuration:');
  console.log('-'.repeat(60));
  console.log('Code:', voucher.code);
  console.log('Type:', voucher.voucher_type);
  console.log('Value:', voucher.value);
  console.log('Application Scope:', voucher.application_scope);
  console.log('Product Application Method:', voucher.product_application_method);
  console.log('Eligible Product IDs:', voucher.eligible_product_ids);

  // Simulate cart with Instamee products
  const cartItems = [
    {
      product_id: 'P0137',
      quantity: 1,
      unit_price: 14.00,
      metadata: { product_name: 'INSTAMEE PREMIUM' }
    },
    {
      product_id: 'P0138',
      quantity: 1,
      unit_price: 17.00,
      metadata: { product_name: 'INSTAMEE LUXURY' }
    },
    {
      product_id: 'P9999',
      quantity: 1,
      unit_price: 50.00,
      metadata: { product_name: 'Some Other Product' }
    }
  ];

  console.log('\n🛒 Simulated Cart:');
  console.log('-'.repeat(60));
  cartItems.forEach((item, i) => {
    console.log(`${i + 1}. ${item.metadata.product_name} (${item.product_id})`);
    console.log(`   Price: RM ${item.unit_price.toFixed(2)} × ${item.quantity}`);
  });

  const subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  console.log(`\nSubtotal: RM ${subtotal.toFixed(2)}`);

  // Test discount calculation
  console.log('\n💰 Discount Calculation:');
  console.log('-'.repeat(60));

  if (voucher.application_scope === 'product_level' && voucher.product_application_method === 'per_product') {
    console.log('✅ Per-product voucher detected');

    // Check eligible products
    if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
      console.log('\n🔍 Checking each cart item:');

      cartItems.forEach((item, i) => {
        const isEligible = voucher.eligible_product_ids.includes(item.product_id);
        console.log(`\n${i + 1}. ${item.metadata.product_name} (${item.product_id})`);
        console.log(`   Checking: Is "${item.product_id}" in [${voucher.eligible_product_ids.join(', ')}]?`);
        console.log(`   Result: ${isEligible ? '✅ ELIGIBLE' : '❌ NOT ELIGIBLE'}`);

        if (isEligible) {
          const discount = parseFloat(voucher.value) * item.quantity;
          console.log(`   Discount: RM ${voucher.value} × ${item.quantity} = RM ${discount.toFixed(2)}`);
        }
      });

      // Calculate total discount
      const matchingItems = cartItems.filter(item =>
        voucher.eligible_product_ids.includes(item.product_id)
      );

      console.log('\n📊 Summary:');
      console.log(`Total items in cart: ${cartItems.length}`);
      console.log(`Eligible items: ${matchingItems.length}`);

      const applicableCount = matchingItems.reduce((sum, item) => sum + item.quantity, 0);
      console.log(`Applicable product count: ${applicableCount}`);

      const maxProducts = voucher.max_products_per_use || 20;
      const effectiveCount = Math.min(applicableCount, maxProducts);
      console.log(`Effective count (capped at ${maxProducts}): ${effectiveCount}`);

      let totalDiscount = 0;
      if (voucher.voucher_type === 'amount') {
        totalDiscount = parseFloat(voucher.value) * effectiveCount;
      } else if (voucher.voucher_type === 'percent') {
        matchingItems.forEach(item => {
          const itemDiscount = (item.unit_price * parseFloat(voucher.value)) / 100;
          totalDiscount += itemDiscount * item.quantity;
        });
      }

      console.log(`\n💵 Total Discount: RM ${totalDiscount.toFixed(2)}`);
      console.log(`Final Total: RM ${(subtotal - totalDiscount).toFixed(2)}`);

    } else {
      console.log('❌ No eligible products configured!');
    }
  } else {
    console.log('❌ Not a per-product voucher');
  }

  // Now test with actual frontend logic
  console.log('\n\n🔍 Testing Frontend getItemDiscount() Logic:');
  console.log('='.repeat(60));

  cartItems.forEach((item) => {
    console.log(`\nProduct: ${item.metadata.product_name} (${item.product_id})`);

    // Simulate getItemDiscount
    let isEligible = false;

    if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
      isEligible = voucher.eligible_product_ids.includes(item.product_id);
      console.log(`  Eligible check: voucher.eligible_product_ids.includes("${item.product_id}")`);
      console.log(`  Result: ${isEligible}`);
    } else {
      console.log('  ⚠️ No eligible products configured - returns null');
    }

    if (isEligible) {
      if (voucher.voucher_type === 'amount') {
        const discountPerItem = parseFloat(voucher.value);
        console.log(`  ✅ Badge should show: "DISCOUNT RM${discountPerItem}"`);
        console.log(`  ✅ Total discount for this product: RM${(discountPerItem * item.quantity).toFixed(2)}`);
      }
    } else {
      console.log(`  ❌ No badge should appear`);
    }
  });
}

testInstameeDiscount().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete!\n');
}).catch(err => {
  console.error('❌ Error:', err);
});
