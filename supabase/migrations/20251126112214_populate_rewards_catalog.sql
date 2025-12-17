/*
  # Populate Rewards Catalog

  1. Purpose
    - Add initial rewards items to the rewards catalog
    - Categorize rewards appropriately (entry tickets, toys, merch, vip)

  2. Rewards Added
    - Family tickets (4 and 2 tickets)
    - Food items (Instamee, drinks, snacks)
    - Cash vouchers (RM10, RM25, RM50)

  3. Notes
    - All rewards are set to active by default
    - Stock set to 999 for unlimited availability
    - Stars cost based on provided pricing
    - Categories assigned logically
*/

-- Insert rewards into the catalog
INSERT INTO rewards (name, description, category, base_cost_stars, stock, is_active) VALUES
  ('4 Family Tickets', 'Four entry tickets for the whole family to enjoy WonderStars together', 'entry', 3000, 999, true),
  ('2 Family Tickets', 'Two entry tickets for a fun day at WonderStars', 'entry', 1800, 999, true),
  ('Instamee Samyang', 'Spicy Samyang instant noodles - Hot and delicious!', 'toys', 750, 999, true),
  ('Instamee Maggi', 'Classic Maggi instant noodles - Quick and tasty', 'toys', 500, 999, true),
  ('Ice Coffee', 'Refreshing iced coffee to cool you down', 'merch', 250, 999, true),
  ('Milkshake', 'Creamy and delicious milkshake in your favorite flavor', 'merch', 350, 999, true),
  ('Mega Ice Cream', 'Extra large ice cream cone with premium toppings', 'merch', 450, 999, true),
  ('Chicken Nuggets', 'Crispy golden chicken nuggets - Perfect for kids!', 'merch', 600, 999, true),
  ('Nachos with Cheesy Sausage', 'Crunchy nachos topped with cheesy sausage', 'merch', 450, 999, true),
  ('Cash Voucher RM10', 'RM10 cash voucher to spend at WonderStars', 'vip', 300, 999, true),
  ('Cash Voucher RM25', 'RM25 cash voucher to spend at WonderStars', 'vip', 700, 999, true),
  ('Cash Voucher RM50', 'RM50 cash voucher to spend at WonderStars', 'vip', 1200, 999, true)
ON CONFLICT DO NOTHING;