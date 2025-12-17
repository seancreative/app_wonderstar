# Staff Scanner Quick Login Guide

## Overview

The Staff Scanner feature allows staff members to quickly access the QR code scanner using their email and a 4-digit passcode. This mobile-optimized interface is designed for on-the-go scanning with large touch targets and simplified navigation.

## Features

### 1. Tabbed Login Interface
- **Admin Login Tab**: Standard email/password login for full CMS access
- **Staff Scanner Tab**: Quick email + 4-digit passcode login for scanner-only access

### 2. Mobile-Optimized Scanner
- **Large Touch Targets**: Buttons sized for easy mobile interaction
- **Full-Screen Camera**: Immersive scanning experience
- **Quick Feedback**: Instant visual feedback on successful/failed scans
- **Auto-Continue**: Automatically returns to scanning after successful scan

### 3. Security
- Staff members have restricted access (scanner only)
- Separate authentication from admin users
- Session management with secure logout

## Usage Instructions

### For Staff Members

1. **Login**
   - Go to `/cms/login`
   - Click on the "Staff Scanner" tab
   - Enter your email address
   - Enter your 4-digit passcode
   - Click "Sign In"

2. **Scanning QR Codes**
   - After login, you'll see the Staff Scanner interface
   - Click "Start Camera Scanner" to begin
   - Point your camera at a customer's QR code
   - The system will automatically:
     - Detect and scan the code
     - Add stars to the customer's account
     - Show success confirmation
     - Return to scanning mode

3. **Logout**
   - Click the "Logout" button in the top-right corner
   - You'll be redirected to the login page

### For Administrators

#### Creating Staff Members

Run the provided script to create a test staff member:

```bash
node create-staff.js
```

Or manually insert into the database:

```sql
INSERT INTO staff_passcodes (
  staff_name,
  email,
  passcode,
  outlet_id,
  is_active,
  description
) VALUES (
  'Staff Name',
  'staff@example.com',
  '1234',
  NULL,  -- NULL for global access, or specific outlet_id
  true,
  'Staff member description'
);
```

#### Managing Staff Access

- Email must be unique across all staff members
- Passcode must be exactly 4 digits (0000-9999)
- Set `is_active` to false to temporarily disable access
- Set `outlet_id` to restrict to specific outlet, or NULL for all outlets

## Test Credentials

After running `create-staff.js`, you can test with:

- **Email**: staff@wonderstars.com
- **Passcode**: 1234

## Mobile Optimization Features

1. **Responsive Design**: Adapts to all screen sizes
2. **Touch-Friendly**: Large buttons (minimum 44x44px)
3. **Camera Controls**: Full-screen camera view with easy exit
4. **Visual Feedback**: Clear success/error messages
5. **Performance**: Fast scanning and processing

## Technical Details

### Routes
- `/cms/login` - Login page with tabs
- `/cms/staff-scanner` - Staff-only mobile scanner (protected)

### Authentication
- Uses `StaffAuthContext` for state management
- Stores session in localStorage
- Validates email + passcode against `staff_passcodes` table

### Database Schema
```sql
staff_passcodes {
  id: uuid
  staff_name: text
  email: text (unique)
  passcode: text (4 digits)
  outlet_id: uuid (nullable)
  is_active: boolean
  is_superadmin: boolean
  description: text
  last_used_at: timestamp
}
```

## Troubleshooting

### Camera Not Working
- Ensure browser has camera permissions
- Try using HTTPS (required for camera access)
- Check that no other app is using the camera

### Login Failed
- Verify email and passcode are correct
- Check that staff member is active (`is_active = true`)
- Ensure passcode is exactly 4 digits

### Scanner Not Detecting QR Code
- Ensure good lighting
- Hold camera steady
- Make sure QR code is clearly visible
- Try moving camera closer or farther

## Future Enhancements

Potential improvements for the staff scanner:
- Offline mode support
- Scan history for staff members
- Multiple outlet support per staff member
- Analytics dashboard for staff activity
- Push notifications for scan confirmations
