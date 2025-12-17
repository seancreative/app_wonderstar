/*
  # Update Wallet Top-up Packages

  Updates the wallet top-up packages with new amounts and bonus structure:
  - RM1: No bonus, no voucher
  - RM10: No bonus, no voucher
  - RM30: 3% extra stars, RM2 voucher
  - RM50: 5% extra stars, RM5 voucher (recommended)
  - RM100: 10% extra stars, RM12 voucher
  - RM200: 15% extra stars, RM30 voucher
  - RM500: 20% extra stars, RM80 voucher
*/

-- Clear existing packages
DELETE FROM wallet_topup_packages;

-- Insert new packages with updated structure
INSERT INTO wallet_topup_packages (amount, bonus_percentage, bonus_points, display_order, is_active) VALUES
(1, 0, 0, 1, true),
(10, 0, 0, 2, true),
(30, 3, 1, 3, true),
(50, 5, 3, 4, true),
(100, 10, 10, 5, true),
(200, 15, 30, 6, true),
(500, 20, 100, 7, true);
