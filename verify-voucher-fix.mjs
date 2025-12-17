#!/usr/bin/env node

/**
 * Verify Voucher Fix - Test that eligible_product_ids is properly fetched
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

console.log('🔍 Verifying Voucher Data Fetch Fix\n');
console.log('='.repeat(70));

async function verifyFix() {
  // Test 1: Direct voucher query
  console.log('\n📋 TEST 1: Direct Voucher Query');
  console.log('-'.repeat(70));

  const { data: directVoucher, error: directError } = await supabase
    .from('vouchers')
    .select('code, eligible_product_ids, application_scope, product_application_method')
    .eq('code', 'DISCOUNT5')
    .single();

  if (directError) {
    console.error('❌ Error fetching voucher:', directError);
    return;
  }

  console.log('Code:', directVoucher.code);
  console.log('Application Scope:', directVoucher.application_scope);
  console.log('Product Application Method:', directVoucher.product_application_method);
  console.log('Eligible Product IDs:', directVoucher.eligible_product_ids);
  console.log('Type:', typeof directVoucher.eligible_product_ids);
  console.log('Is Array:', Array.isArray(directVoucher.eligible_product_ids));
  console.log('Length:', directVoucher.eligible_product_ids?.length || 0);

  if (!directVoucher.eligible_product_ids || directVoucher.eligible_product_ids.length === 0) {
    console.log('❌ FAIL: No eligible products in voucher!');
    return;
  } else {
    console.log('✅ PASS: Voucher has', directVoucher.eligible_product_ids.length, 'eligible products');
  }

  // Test 2: User voucher query (OLD WAY - with *)
  console.log('\n\n📋 TEST 2: User Voucher Query (OLD - using *)');
  console.log('-'.repeat(70));

  const { data: oldWayVouchers } = await supabase
    .from('user_vouchers')
    .select(`
      id,
      voucher:vouchers(*)
    `)
    .eq('voucher_id', directVoucher.id)
    .limit(1);

  if (oldWayVouchers && oldWayVouchers.length > 0) {
    const oldWay = oldWayVouchers[0];
    console.log('User Voucher ID:', oldWay.id);
    console.log('Nested voucher.code:', oldWay.voucher?.code);
    console.log('Nested voucher.eligible_product_ids:', oldWay.voucher?.eligible_product_ids);
    console.log('Type:', typeof oldWay.voucher?.eligible_product_ids);
    console.log('Is Array:', Array.isArray(oldWay.voucher?.eligible_product_ids));
    console.log('Length:', oldWay.voucher?.eligible_product_ids?.length || 0);

    if (!oldWay.voucher?.eligible_product_ids || oldWay.voucher.eligible_product_ids.length === 0) {
      console.log('❌ ISSUE: Using * does NOT return eligible_product_ids properly!');
    } else {
      console.log('✅ PASS: Old way works (surprising!)');
    }
  } else {
    console.log('⚠️  No user_vouchers found for this voucher');
  }

  // Test 3: User voucher query (NEW WAY - explicit fields)
  console.log('\n\n📋 TEST 3: User Voucher Query (NEW - explicit fields)');
  console.log('-'.repeat(70));

  const { data: newWayVouchers } = await supabase
    .from('user_vouchers')
    .select(`
      id,
      voucher:vouchers(
        id,
        code,
        title,
        voucher_type,
        value,
        application_scope,
        product_application_method,
        eligible_product_ids,
        eligible_category_ids,
        eligible_subcategory_ids,
        min_purchase,
        max_products_per_use
      )
    `)
    .eq('voucher_id', directVoucher.id)
    .limit(1);

  if (newWayVouchers && newWayVouchers.length > 0) {
    const newWay = newWayVouchers[0];
    console.log('User Voucher ID:', newWay.id);
    console.log('Nested voucher.code:', newWay.voucher?.code);
    console.log('Nested voucher.eligible_product_ids:', newWay.voucher?.eligible_product_ids);
    console.log('Type:', typeof newWay.voucher?.eligible_product_ids);
    console.log('Is Array:', Array.isArray(newWay.voucher?.eligible_product_ids));
    console.log('Length:', newWay.voucher?.eligible_product_ids?.length || 0);

    if (!newWay.voucher?.eligible_product_ids || newWay.voucher.eligible_product_ids.length === 0) {
      console.log('❌ FAIL: Explicit fields still not working!');
    } else {
      console.log('✅ PASS: Explicit fields return eligible_product_ids correctly!');
      console.log('✅ Products:', newWay.voucher.eligible_product_ids.join(', '));
    }
  } else {
    console.log('⚠️  No user_vouchers found for this voucher');
  }

  // Test 4: Check Instamee products
  console.log('\n\n📋 TEST 4: Verify Instamee Products in Eligible List');
  console.log('-'.repeat(70));

  const instameeProducts = ['P0137', 'P0088', 'P0138', 'P0089'];
  const eligibleIds = directVoucher.eligible_product_ids || [];

  console.log('Checking products:', instameeProducts);
  console.log('Against eligible list:', eligibleIds);

  let allMatch = true;
  instameeProducts.forEach(productId => {
    const isEligible = eligibleIds.includes(productId);
    console.log(`  ${productId}: ${isEligible ? '✅ ELIGIBLE' : '❌ NOT ELIGIBLE'}`);
    if (!isEligible) allMatch = false;
  });

  if (allMatch) {
    console.log('\n✅ SUCCESS: All Instamee products are in eligible list!');
  } else {
    console.log('\n❌ ISSUE: Some Instamee products missing from eligible list');
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));

  const hasEligibleProducts = directVoucher.eligible_product_ids && directVoucher.eligible_product_ids.length > 0;
  const instameeEligible = instameeProducts.every(id => eligibleIds.includes(id));

  if (hasEligibleProducts && instameeEligible) {
    console.log('✅ FIX VERIFIED: Database has correct data');
    console.log('✅ All Instamee products are eligible for DISCOUNT5');
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('1. Clear your browser cache (Ctrl+Shift+R)');
    console.log('2. Remove DISCOUNT5 from your vouchers');
    console.log('3. Re-redeem DISCOUNT5 code');
    console.log('4. Apply it to cart with Instamee products');
    console.log('5. Check browser console - should now see eligible_product_ids with 8 items');
    console.log('6. Discount should apply: RM5 per Instamee product');
  } else {
    console.log('❌ ISSUE: Database configuration problem');
    if (!hasEligibleProducts) {
      console.log('   - Voucher has no eligible products configured');
    }
    if (!instameeEligible) {
      console.log('   - Some Instamee products not in eligible list');
    }
  }
}

verifyFix().then(() => {
  console.log('\n' + '='.repeat(70));
  console.log('✅ Verification complete!\n');
}).catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
