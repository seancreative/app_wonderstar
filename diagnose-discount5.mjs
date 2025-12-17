#!/usr/bin/env node

/**
 * DISCOUNT5 Diagnostic Script
 *
 * This script checks the DISCOUNT5 voucher configuration in the database
 * and identifies why it might not be working.
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

console.log('🔍 DISCOUNT5 Voucher Diagnostic Tool\n');
console.log('=' .repeat(60));

async function diagnoseDISCOUNT5() {
  try {
    // 1. Check if DISCOUNT5 exists
    console.log('\n📋 Step 1: Checking if DISCOUNT5 exists...');
    const { data: voucher, error: voucherError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', 'DISCOUNT5')
      .maybeSingle();

    if (voucherError) {
      console.error('❌ Error querying vouchers:', voucherError.message);
      return;
    }

    if (!voucher) {
      console.log('❌ DISCOUNT5 voucher NOT FOUND in database!');
      console.log('\n💡 Solution: Create DISCOUNT5 voucher in CMS');
      return;
    }

    console.log('✅ DISCOUNT5 found in database');
    console.log('\n📊 Current Configuration:');
    console.log('-'.repeat(60));

    // 2. Check critical fields
    console.log(`Code: ${voucher.code}`);
    console.log(`Title: ${voucher.title}`);
    console.log(`Active: ${voucher.is_active ? '✅ YES' : '❌ NO (PROBLEM!)'}`);
    console.log(`Voucher Type: ${voucher.voucher_type}`);
    console.log(`Value: ${voucher.value}`);
    console.log(`Application Scope: ${voucher.application_scope || '❌ NULL (PROBLEM!)'}`);
    console.log(`Product Application Method: ${voucher.product_application_method || '❌ NULL (PROBLEM!)'}`);
    console.log(`Min Purchase: RM ${voucher.min_purchase || 0}`);
    console.log(`Max Products Per Use: ${voucher.max_products_per_use || 'unlimited'}`);
    console.log(`Daily Redeemable: ${voucher.is_daily_redeemable ? 'Yes' : 'No'}`);
    console.log(`Restriction Type: ${voucher.restriction_type || 'none'}`);

    // 3. Check eligible_product_ids
    console.log('\n🎯 Eligible Products:');
    console.log('-'.repeat(60));

    if (!voucher.eligible_product_ids || voucher.eligible_product_ids.length === 0) {
      console.log('❌ NO ELIGIBLE PRODUCTS CONFIGURED!');
      console.log('   This is why the voucher gives RM0 discount.');
      console.log('\n💡 Solution: Go to CMS → Marketing → Vouchers → Edit DISCOUNT5');
      console.log('   and select at least 1 eligible product.');
    } else {
      console.log(`✅ ${voucher.eligible_product_ids.length} products configured:`);
      console.log(`   Product IDs: ${JSON.stringify(voucher.eligible_product_ids)}`);

      // Get product details
      const { data: products } = await supabase
        .from('shop_products')
        .select('product_id, product_name, price, is_active')
        .in('product_id', voucher.eligible_product_ids);

      if (products && products.length > 0) {
        console.log('\n   Product Details:');
        products.forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.product_name} (${p.product_id})`);
          console.log(`      Price: RM ${p.price}`);
          console.log(`      Active: ${p.is_active ? '✅' : '❌'}`);
        });
      }
    }

    // 4. Check categories
    if (voucher.eligible_category_ids && voucher.eligible_category_ids.length > 0) {
      console.log('\n📂 Eligible Categories:');
      console.log(`   ${voucher.eligible_category_ids.length} categories: ${JSON.stringify(voucher.eligible_category_ids)}`);
    }

    // 5. Check subcategories
    if (voucher.eligible_subcategory_ids && voucher.eligible_subcategory_ids.length > 0) {
      console.log('\n📁 Eligible Subcategories:');
      console.log(`   ${voucher.eligible_subcategory_ids.length} subcategories: ${JSON.stringify(voucher.eligible_subcategory_ids)}`);
    }

    // 6. Validate configuration
    console.log('\n🔬 Configuration Analysis:');
    console.log('-'.repeat(60));

    const issues = [];
    const warnings = [];

    if (!voucher.is_active) {
      issues.push('Voucher is INACTIVE - users cannot see or use it');
    }

    if (!voucher.application_scope) {
      issues.push('application_scope is NULL - should be "product_level" for per-product discount');
    } else if (voucher.application_scope !== 'product_level') {
      warnings.push(`application_scope is "${voucher.application_scope}" - per-product requires "product_level"`);
    }

    if (!voucher.product_application_method) {
      issues.push('product_application_method is NULL - should be "per_product" for RM5 per item');
    } else if (voucher.product_application_method !== 'per_product') {
      warnings.push(`product_application_method is "${voucher.product_application_method}" - should be "per_product"`);
    }

    if (!voucher.eligible_product_ids || voucher.eligible_product_ids.length === 0) {
      issues.push('NO eligible products configured - voucher will give RM0 discount');
    }

    if (voucher.voucher_type !== 'amount' && voucher.voucher_type !== 'percent') {
      issues.push(`voucher_type is "${voucher.voucher_type}" - should be "amount" or "percent"`);
    }

    // Display issues
    if (issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES FOUND:');
      issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    } else {
      console.log('✅ No critical issues found');
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`);
      });
    }

    // 7. Expected behavior
    console.log('\n📖 Expected Behavior:');
    console.log('-'.repeat(60));

    if (issues.length === 0 && warnings.length === 0) {
      console.log('✅ With current configuration, DISCOUNT5 should:');
      console.log(`   - Apply ${voucher.voucher_type === 'amount' ? `RM ${voucher.value}` : `${voucher.value}%`} discount per product`);
      console.log(`   - Only apply to ${voucher.eligible_product_ids?.length || 0} specific products`);
      console.log(`   - Show discount badge on eligible products only`);
      console.log(`   - Calculate total discount based on eligible items in cart`);

      if (voucher.max_products_per_use) {
        console.log(`   - Maximum ${voucher.max_products_per_use} products per order`);
      }

      if (voucher.min_purchase > 0) {
        console.log(`   - Requires minimum purchase of RM ${voucher.min_purchase}`);
      }
    } else {
      console.log('❌ Current configuration will NOT work correctly');
      console.log('   Fix the issues above first');
    }

    // 8. How to fix
    if (issues.length > 0 || warnings.length > 0) {
      console.log('\n🔧 How to Fix:');
      console.log('-'.repeat(60));
      console.log('1. Login to CMS as admin');
      console.log('2. Go to Marketing → Vouchers');
      console.log('3. Find and edit DISCOUNT5');
      console.log('4. Set the following:');

      if (!voucher.is_active) {
        console.log('   ✓ Active: YES (toggle on)');
      }

      if (voucher.application_scope !== 'product_level') {
        console.log('   ✓ Application Scope: "product_level"');
      }

      if (voucher.product_application_method !== 'per_product') {
        console.log('   ✓ Product Application Method: "per_product"');
      }

      if (!voucher.eligible_product_ids || voucher.eligible_product_ids.length === 0) {
        console.log('   ✓ Eligible Products: SELECT AT LEAST 1 PRODUCT');
      }

      console.log('5. Save changes');
      console.log('6. Test by adding eligible products to cart');
    }

    // 9. Test sample cart
    console.log('\n🧪 Sample Test Scenario:');
    console.log('-'.repeat(60));
    console.log('Cart contains:');
    console.log('  - Ice Cream (P0138) × 2 = RM 20.00');
    console.log('  - Bubble Tea (P9999) × 1 = RM 12.00');
    console.log('  - Pizza (P0555) × 1 = RM 50.00');
    console.log('  Subtotal: RM 82.00');

    if (voucher.eligible_product_ids && voucher.eligible_product_ids.length > 0) {
      const eligibleInSample = ['P0138', 'P9999', 'P0555'].filter(id =>
        voucher.eligible_product_ids.includes(id)
      );

      if (eligibleInSample.length > 0) {
        console.log(`\n✅ Eligible products in this cart: ${eligibleInSample.join(', ')}`);

        if (voucher.voucher_type === 'amount') {
          const discount = parseFloat(voucher.value);
          let totalDiscount = 0;

          if (eligibleInSample.includes('P0138')) totalDiscount += discount * 2; // qty 2
          if (eligibleInSample.includes('P9999')) totalDiscount += discount * 1;
          if (eligibleInSample.includes('P0555')) totalDiscount += discount * 1;

          console.log(`   Expected discount: RM ${totalDiscount.toFixed(2)}`);
          console.log(`   Final total: RM ${(82 - totalDiscount).toFixed(2)}`);
        }
      } else {
        console.log('\n❌ None of these products are eligible for DISCOUNT5');
        console.log('   Expected discount: RM 0.00');
        console.log('   You need to add eligible products to cart or update voucher configuration');
      }
    } else {
      console.log('\n❌ No products eligible (empty list)');
      console.log('   Expected discount: RM 0.00');
    }

  } catch (error) {
    console.error('\n❌ Error running diagnostic:', error);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Diagnostic complete!\n');
}

// Run diagnostic
diagnoseDISCOUNT5();
