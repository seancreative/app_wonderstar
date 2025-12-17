# Outlet Cover Image Display Fix - Complete ✅

## Problem
Cover images uploaded through CMS > Settings > Outlets were not showing on the frontend outlet selection page.

## Root Cause
- CMS was saving images to `cover_image_url` column in Supabase Storage
- Frontend was reading from `image_url` column (old Pexels stock photos)
- Database has both columns but frontend wasn't using the uploaded ones

## Solution
Updated frontend to prioritize `cover_image_url` over `image_url` with fallback:

### Files Modified:

1. **src/pages/OutletSelection.tsx**
   - Added `cover_image_url?: string` to Outlet interface
   - Changed image source from `outlet.image_url` to `outlet.cover_image_url || outlet.image_url`
   - This prioritizes uploaded cover images with fallback to stock photos

2. **src/contexts/ShopContext.tsx**
   - Added `cover_image_url?: string` to Outlet interface
   - Updated query to include `cover_image_url` in SELECT
   - Added field to outlet state object

## How It Works Now

1. Admin uploads cover image in CMS > Settings > Outlets
2. Image saved to Supabase Storage bucket `outlet-covers`
3. URL stored in `outlets.cover_image_url` column
4. Frontend loads outlets with both fields
5. Display logic: `cover_image_url || image_url` (uploaded first, stock photo fallback)

## Benefits

- Uploaded images now display immediately
- Backwards compatible (falls back to old image_url if no cover uploaded)
- No database migration needed
- No breaking changes to existing outlets

## Testing

Verified with existing data:
- WONDERPARK KUALA TERENGGANU: Has uploaded cover image
- WONDERPARK MELAKA: Has uploaded cover image
- Both show uploaded images on outlet selection page

## Image Storage Details

- Bucket: `outlet-covers` (Supabase Storage)
- File naming: `{outlet-id}-{timestamp}.{ext}`
- Public access enabled
- Example URL format:
  ```
  https://[project].supabase.co/storage/v1/object/public/outlet-covers/[outlet-id]-[timestamp].jpg
  ```
