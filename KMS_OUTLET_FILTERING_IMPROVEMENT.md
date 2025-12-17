# KMS Outlet Filtering Enhancement

## Summary

Enhanced the Kitchen Management System outlet filtering to provide better visibility and control over which outlet's orders are displayed. Outlets are now retrieved from the CMS database (single source of truth) with improved visual design.

## What Changed

### 1. Improved Outlet Selection UI

**Before:**
- Small "All Outlets" / "Current Only" toggle button in header
- Outlet buttons only shown for admin users
- No order counts per outlet
- Less visual distinction

**After:**
- Dedicated "Filter by Outlet" section with clear header
- "All Outlets" button integrated with individual outlet buttons
- Order counts displayed for each outlet
- Better visual hierarchy and color coding
- Shows outlet location alongside name
- Visible to all users (not just admins)

### 2. Visual Design Improvements

**All Outlets Button:**
- Blue gradient background when selected
- Shows total order count
- Scale effect when active
- Clear "All Outlets" label

**Individual Outlet Buttons:**
- Green gradient background when selected
- Shows outlet name, location, and order count
- Hover effects for better interactivity
- Consistent sizing and spacing

**Filter Section:**
- White background card with shadow
- Shows current filter status in header
- Horizontally scrollable for many outlets
- Proper spacing and padding

### 3. Header Information

**Enhanced Header Display:**
- Shows "All Outlets (2 locations)" when all outlets selected
- Shows "Melaka - Melaka City" when specific outlet selected
- Clear indication of what's being displayed

## Features

### Outlet Information Display

Each outlet button shows:
1. **Outlet Name** - e.g., "Melaka", "Kuala Terengganu"
2. **Location** - e.g., "Melaka City", "Terengganu"
3. **Order Count** - Number of current orders from that outlet

### Visual States

**All Outlets (Blue):**
- Active: Blue gradient with scale effect
- Inactive: White background with gray border
- Shows total order count across all outlets

**Specific Outlet (Green):**
- Active: Green gradient with scale effect
- Inactive: White background with gray border
- Shows order count for that specific outlet

### Responsive Design

- Horizontally scrollable on smaller screens
- Maintains proper spacing and sizing
- Touch-friendly button sizes
- Clear visual feedback on selection

## Technical Implementation

### Data Source

Outlets are retrieved from the `outlets` table in Supabase:
```typescript
const { data, error } = await supabase
  .from('outlets')
  .select('id, name, location')
  .eq('is_active', true)
  .order('name');
```

### Order Counting

Real-time order counts per outlet:
```typescript
const outletOrderCount = orders.filter(o => o.outlet_id === outlet.id).length;
```

### Filter Logic

- When "All Outlets" selected: Shows orders from all outlets
- When specific outlet selected: Filters to show only that outlet's orders
- Real-time subscription updates based on selected filter

## User Experience

### Kitchen Staff Workflow

1. **View All Orders:**
   - Click "All Outlets" button (blue when active)
   - See orders from all locations
   - Header shows "All Outlets (X locations)"

2. **Filter by Specific Outlet:**
   - Click outlet button (e.g., "Melaka")
   - Button turns green when selected
   - See only orders from that outlet
   - Header shows "Melaka - Melaka City"

3. **Quick Comparison:**
   - See order counts for each outlet at a glance
   - Quickly identify which location is busiest
   - Easy to switch between outlets

### Visual Indicators

- **Blue = All Outlets** (comprehensive view)
- **Green = Specific Outlet** (focused view)
- **Order Counts** visible on all buttons
- **Scale Effect** makes active selection obvious

## Benefits

1. **Single Source of Truth:** Outlets from CMS database ensure consistency
2. **Better Visibility:** Clear display of which outlet is selected
3. **Order Counts:** Instant visibility of workload per outlet
4. **Improved UX:** Intuitive color coding and visual feedback
5. **Scalability:** Works with 2+ outlets, scrollable interface
6. **Real-time:** Order counts update automatically

## Example Outlets

Based on your locations:
- **Melaka** - Melaka City
- **Kuala Terengganu** - Terengganu

Each will show:
- Outlet name in large text
- Location in smaller text
- Current order count
- Visual state (active/inactive)

## Mobile Responsive

- Buttons maintain minimum width of 180px
- Horizontal scroll for multiple outlets
- Touch-friendly tap targets
- Clear visual feedback

## Integration with Existing Features

Works seamlessly with:
- Real-time order updates
- Sound notifications (filtered by selected outlet)
- Status filtering (preparing, ready, etc.)
- Order tracking and item preparation
- Debug panel diagnostics

## Future Enhancements

Possible improvements:
- Outlet-specific notification sounds
- Peak hours indicator per outlet
- Average preparation time per outlet
- Outlet performance metrics
- Quick-switch keyboard shortcuts

## Conclusion

The enhanced outlet filtering provides kitchen staff with better control and visibility over which orders they're viewing. The improved visual design makes it immediately clear which outlet is selected, and the real-time order counts help staff manage workload across multiple locations efficiently.
