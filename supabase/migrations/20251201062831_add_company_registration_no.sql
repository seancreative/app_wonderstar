/*
  # Add Company Registration Number to App Config

  ## Overview
  Adds company_registration_no field to app_config table for displaying
  on receipts and official documents.

  ## Changes
  1. Insert company_registration_no config key into app_config table
  
  ## Usage
  This field will be displayed on receipts below company name in small font.
*/

-- Insert company_registration_no config if it doesn't exist (config_value is jsonb, so use json string)
INSERT INTO app_config (config_key, config_value)
VALUES ('company_registration_no', '""'::jsonb)
ON CONFLICT (config_key) DO NOTHING;
