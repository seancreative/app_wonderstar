# Debug: Gold Coin Not Showing

## ✅ Code Verification

The gold coin display is correctly implemented in `src/pages/EggGachaPage.tsx` at lines 79-104.

## Why You Might Not See It

### Reason 1: User Has 0 Free Spins (Most Likely)
The coin only shows when `freeSpins > 0`. This is intentional - we don't want to show "🪙 x0".

**Solution**: Grant yourself free spins!

#### Option A: Via CMS (Easiest)
1. Go to CMS → Customers
2. Find your user account
3. Scroll to "Gacha Free Spins" section
4. Enter amount (e.g., 5)
5. Select reason (e.g., "Admin Grant")
6. Click "Grant 5 Free Spins"
7. Refresh the Gacha page

#### Option B: Via SQL
```sql
-- Replace with your user ID
SELECT grant_gacha_freespins(
  'YOUR-USER-ID-HERE'::uuid,
  5,
  'testing'
);
```

### Users Already Granted Free Spins:

I've already granted free spins to these test accounts:

| User | Email | Free Spins |
|------|-------|------------|
| DANSON3 | danson3@gmail.com | 5 |
| SEAN TAN2 | seancreative@gmail.com | 3 |
| Danson2 | Danson2@gmail.com | 2 |
| Izzul | izzulfitreee@gmail.com | 5 |

**Try logging in as one of these users to see the gold coin!**

### Reason 2: Page Not Refreshed
After granting free spins, you need to refresh the page or navigate away and back to trigger the `loadFreeSpins()` function.

### Reason 3: Browser Cache
Try hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

## How to Test

### Step 1: Check Your Free Spin Count
```sql
-- Find your user
SELECT id, name, email, gacha_freespin
FROM users
WHERE email = 'your-email@example.com';
```

### Step 2: Grant Yourself Free Spins (if 0)
```sql
SELECT grant_gacha_freespins(
  'your-user-id'::uuid,
  5,
  'test'
);
```

### Step 3: Refresh the Gacha Page
- Navigate to Egg Gacha page
- You should now see: **🪙 x5** between the back button and the title

## What the Gold Coin Looks Like

```
┌─────────────────────────────────────────┐
│ [←]  [🪙 x5]  GACHA & SURE WIN BONUS!  │
│              YOU HAVE 9100              │
└─────────────────────────────────────────┘
```

- Gold gradient box with black border
- Bouncing animation
- Retro "Press Start 2P" font for the number
- Only visible when free spins > 0

## Console Debug

Add this to check if free spins are loading:

1. Open browser console (F12)
2. Go to Gacha page
3. Check for: `Error loading free spins:` message
4. Or add console.log in EggGachaPage.tsx line 38:
   ```typescript
   console.log('Free spins loaded:', data.gacha_freespin);
   ```

## Quick Test Script

Run this to verify your account:

```bash
node test-gacha-freespins.mjs
```

This will show all users with free spins.
