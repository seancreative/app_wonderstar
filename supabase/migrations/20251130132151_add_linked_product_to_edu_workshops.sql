/*
  # Add Product Linking to EDU Workshops

  1. Changes
    - Add `linked_product_id` column to `edu_workshops` table
    - This allows workshops to be linked to shop products
    - When users reserve a workshop, it adds the linked product to their cart
    - Foreign key constraint ensures product exists

  2. Security
    - No RLS changes needed (RLS already disabled for edu_workshops)
*/

-- Add linked_product_id column to edu_workshops
ALTER TABLE edu_workshops
ADD COLUMN IF NOT EXISTS linked_product_id UUID REFERENCES shop_products(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_edu_workshops_linked_product
ON edu_workshops(linked_product_id);

-- Add comment for documentation
COMMENT ON COLUMN edu_workshops.linked_product_id IS 'References the shop product that users will purchase when reserving this workshop';
