#!/usr/bin/env node

/**
 * Database Backup Script
 *
 * This script exports all critical data from the database before enabling RLS.
 * Run this before any migration to ensure data safety.
 *
 * Usage: node backup-database.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES_TO_BACKUP = [
  'users',
  'child_profiles',
  'wallet_transactions',
  'stars_transactions',
  'shop_orders',
  'shop_cart_items',
  'user_vouchers',
  'voucher_redemptions',
  'payment_transactions',
  'redemptions',
  'stamps_tracking',
  'stamps_history',
  'stamps_redemptions',
  'order_item_redemptions',
  'admin_users',
  'staff_passcodes',
];

async function backupTable(tableName) {
  console.log(`Backing up table: ${tableName}...`);

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.error(`Error backing up ${tableName}:`, error.message);
      return { tableName, success: false, error: error.message, count: 0 };
    }

    console.log(`✓ Backed up ${data?.length || 0} rows from ${tableName}`);
    return { tableName, success: true, data, count: data?.length || 0 };
  } catch (err) {
    console.error(`Exception backing up ${tableName}:`, err);
    return { tableName, success: false, error: err.message, count: 0 };
  }
}

async function createBackup() {
  console.log('========================================');
  console.log('DATABASE BACKUP STARTED');
  console.log('========================================\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = {
    timestamp,
    supabaseUrl,
    tables: {},
    summary: {
      totalTables: TABLES_TO_BACKUP.length,
      successCount: 0,
      failureCount: 0,
      totalRows: 0,
    }
  };

  for (const tableName of TABLES_TO_BACKUP) {
    const result = await backupTable(tableName);

    if (result.success) {
      backup.tables[tableName] = result.data;
      backup.summary.successCount++;
      backup.summary.totalRows += result.count;
    } else {
      backup.tables[tableName] = { error: result.error };
      backup.summary.failureCount++;
    }
  }

  const filename = `database-backup-${timestamp}.json`;
  writeFileSync(filename, JSON.stringify(backup, null, 2));

  console.log('\n========================================');
  console.log('BACKUP COMPLETE');
  console.log('========================================');
  console.log(`File: ${filename}`);
  console.log(`Total tables: ${backup.summary.totalTables}`);
  console.log(`Success: ${backup.summary.successCount}`);
  console.log(`Failed: ${backup.summary.failureCount}`);
  console.log(`Total rows backed up: ${backup.summary.totalRows}`);
  console.log('========================================\n');

  if (backup.summary.failureCount > 0) {
    console.warn('WARNING: Some tables failed to backup. Review errors above.');
    process.exit(1);
  }

  console.log('✓ Backup completed successfully!');
  console.log('You can now proceed with the migration.\n');
}

createBackup().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
