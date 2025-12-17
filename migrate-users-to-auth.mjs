#!/usr/bin/env node

/**
 * User Migration Script - Migrate Existing Users to Supabase Auth
 *
 * This script safely migrates all existing users from custom localStorage auth
 * to Supabase Authentication while preserving all user data and relationships.
 *
 * Usage: node migrate-users-to-auth.mjs
 *
 * Requirements:
 * - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 * - Database backup should be created first (run backup-database.mjs)
 *
 * Safety Features:
 * - Dry run mode by default
 * - Verifies each user before migration
 * - Generates secure random passwords
 * - Maintains audit trail
 * - Can be run multiple times (idempotent)
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Missing VITE_SUPABASE_URL in environment');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment');
  console.error('Get it from: https://supabase.com/dashboard/project/_/settings/api');
  process.exit(1);
}

// Create admin client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--execute');
const DEFAULT_PASSWORD_PREFIX = 'TempPass';

function generateSecurePassword() {
  return DEFAULT_PASSWORD_PREFIX + crypto.randomBytes(8).toString('hex');
}

async function migrateUser(user) {
  console.log(`\nMigrating user: ${user.email} (${user.id})`);

  // Check if already migrated
  if (user.auth_migrated) {
    console.log(`  ✓ Already migrated (auth_id: ${user.auth_id})`);
    return { success: true, alreadyMigrated: true };
  }

  const tempPassword = generateSecurePassword();

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create auth user with:`);
    console.log(`    Email: ${user.email}`);
    console.log(`    Temp Password: ${tempPassword}`);
    return { success: true, dryRun: true };
  }

  try {
    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: user.name,
        phone: user.phone,
        migrated_from_custom_auth: true,
        original_user_id: user.id
      }
    });

    if (authError) {
      // Check if user already exists in auth.users
      if (authError.message.includes('already registered')) {
        console.log(`  ! User already exists in auth.users, linking...`);

        // Try to find the auth user by email
        const { data: existingAuthUsers, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) throw listError;

        const existingAuthUser = existingAuthUsers.users.find(u => u.email === user.email);

        if (existingAuthUser) {
          // Link existing auth user to our users table
          const { error: updateError } = await supabase
            .from('users')
            .update({
              auth_id: existingAuthUser.id,
              auth_migrated: true,
              auth_migrated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) throw updateError;

          console.log(`  ✓ Linked to existing auth user: ${existingAuthUser.id}`);
          return { success: true, linked: true, authId: existingAuthUser.id };
        }
      }

      throw authError;
    }

    // Update users table with auth_id
    const { error: updateError } = await supabase
      .from('users')
      .update({
        auth_id: authData.user.id,
        auth_migrated: true,
        auth_migrated_at: new Date().toISOString(),
        password_hash: `TEMP:${tempPassword}` // Store temporarily for user reference
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    console.log(`  ✓ Created auth user: ${authData.user.id}`);
    console.log(`  ✓ Temporary password: ${tempPassword}`);

    return {
      success: true,
      authId: authData.user.id,
      tempPassword
    };

  } catch (error) {
    console.error(`  ✗ Error migrating user:`, error.message);
    return { success: false, error: error.message };
  }
}

async function migrateAllUsers() {
  console.log('========================================');
  console.log('USER MIGRATION TO SUPABASE AUTH');
  console.log('========================================\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('Run with --execute flag to perform actual migration\n');
  } else {
    console.log('⚠️  LIVE MODE - Changes will be made to the database');
    console.log('Press Ctrl+C now if you want to cancel\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Fetch all users
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch users:', error);
    process.exit(1);
  }

  console.log(`Found ${users.length} users to migrate\n`);

  const results = {
    total: users.length,
    success: 0,
    failed: 0,
    alreadyMigrated: 0,
    passwords: []
  };

  for (const user of users) {
    const result = await migrateUser(user);

    if (result.success) {
      if (result.alreadyMigrated) {
        results.alreadyMigrated++;
      } else {
        results.success++;
        if (result.tempPassword) {
          results.passwords.push({
            email: user.email,
            name: user.name,
            password: result.tempPassword
          });
        }
      }
    } else {
      results.failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n========================================');
  console.log('MIGRATION COMPLETE');
  console.log('========================================');
  console.log(`Total users: ${results.total}`);
  console.log(`Successfully migrated: ${results.success}`);
  console.log(`Already migrated: ${results.alreadyMigrated}`);
  console.log(`Failed: ${results.failed}`);
  console.log('========================================\n');

  if (!DRY_RUN && results.passwords.length > 0) {
    console.log('TEMPORARY PASSWORDS (Send to users):');
    console.log('=====================================');
    results.passwords.forEach(({ email, name, password }) => {
      console.log(`${name} (${email}): ${password}`);
    });
    console.log('=====================================\n');
    console.log('⚠️  IMPORTANT: Save these passwords and send to users!');
    console.log('Users should change their passwords on first login.\n');
  }

  if (DRY_RUN) {
    console.log('To perform actual migration, run:');
    console.log('node migrate-users-to-auth.mjs --execute\n');
  }
}

migrateAllUsers().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
