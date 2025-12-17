/*
  # Update Facilities Categories

  1. Changes
    - Update outlet_facilities category enum to include 'facilities'
    - This allows us to categorize items as general facilities (washrooms, cafe, etc.)
*/

ALTER TABLE outlet_facilities 
DROP CONSTRAINT IF EXISTS outlet_facilities_category_check;

ALTER TABLE outlet_facilities
ADD CONSTRAINT outlet_facilities_category_check 
CHECK (category IN ('everyone', 'adult', 'child', 'facilities'));
