#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('='.repeat(80));
console.log('CMS PRODUCT SAVE DIAGNOSTIC');
console.log('='.repeat(80));

// Test 1: Check if we can read products
console.log('\n[TEST 1] Reading shop_products...');
const { data: products, error: productsError } = await supabase
  .from('shop_products')
  .select('*')
  .limit(1);

if (productsError) {
  console.error('❌ Failed to read products:', productsError.message);
} else {
  console.log('✓ Can read products:', products?.length || 0);
}

// Test 2: Check modifier_groups policies
console.log('\n[TEST 2] Checking modifier_groups policies...');
const { data: modGroups, error: modGroupsError } = await supabase
  .from('modifier_groups')
  .select('*')
  .limit(1);

if (modGroupsError) {
  console.error('❌ Failed to read modifier_groups:', modGroupsError.message);
} else {
  console.log('✓ Can read modifier_groups:', modGroups?.length || 0);
}

// Test 3: Check modifier_options policies
console.log('\n[TEST 3] Checking modifier_options policies...');
const { data: modOptions, error: modOptionsError } = await supabase
  .from('modifier_options')
  .select('*')
  .limit(1);

if (modOptionsError) {
  console.error('❌ Failed to read modifier_options:', modOptionsError.message);
} else {
  console.log('✓ Can read modifier_options:', modOptions?.length || 0);
}

// Test 4: Check product_modifiers policies
console.log('\n[TEST 4] Checking product_modifiers policies...');
const { data: prodMods, error: prodModsError } = await supabase
  .from('product_modifiers')
  .select('*')
  .limit(1);

if (prodModsError) {
  console.error('❌ Failed to read product_modifiers:', prodModsError.message);
} else {
  console.log('✓ Can read product_modifiers:', prodMods?.length || 0);
}

// Test 5: Check product_outlets policies
console.log('\n[TEST 5] Checking product_outlets policies...');
const { data: prodOutlets, error: prodOutletsError } = await supabase
  .from('product_outlets')
  .select('*')
  .limit(1);

if (prodOutletsError) {
  console.error('❌ Failed to read product_outlets:', prodOutletsError.message);
} else {
  console.log('✓ Can read product_outlets:', prodOutlets?.length || 0);
}

// Test 6: Check RLS policies
console.log('\n[TEST 6] Checking RLS policy details...');
const { data: policies, error: policiesError } = await supabase.rpc('exec_sql', {
  sql: `
    SELECT tablename, policyname, cmd, roles::text
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('shop_products', 'modifier_groups', 'modifier_options', 'product_modifiers', 'product_outlets')
    ORDER BY tablename, cmd, policyname;
  `
});

if (!policiesError && policies) {
  console.log('Policies found:', policies);
} else {
  console.log('Could not fetch policies (expected with anon key)');
}

console.log('\n' + '='.repeat(80));
console.log('DIAGNOSTIC COMPLETE');
console.log('='.repeat(80));
console.log('\nRECOMMENDATION:');
console.log('If any tables show errors, the RLS policies may be blocking CMS operations.');
console.log('CMS admin authentication needs to be verified.');
console.log('='.repeat(80));
