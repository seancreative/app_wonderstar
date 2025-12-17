# Critical Updates Implementation Plan

## Files Completed

1. ✅ `supabase/migrations/20251111000000_enhance_staff_and_rewards_system.sql`
2. ✅ `src/types/database.ts` 
3. ✅ `src/components/cms/ImageUploadWithCrop.tsx`
4. ✅ `src/pages/cms/CMSOutlets.tsx` - Enhanced with outlet ID

## Files That Need Manual Updates

### PRIORITY 1: CMSProducts.tsx Updates Needed

**Location:** `src/pages/cms/CMSProducts.tsx`

**Changes Required:**

1. **Add Import:**
```typescript
import ImageUploadWithCrop from '../../components/cms/ImageUploadWithCrop';
```

2. **Add State Variables (after line 61):**
```typescript
const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
const [showBulkActions, setShowBulkActions] = useState(false);
```

3. **Add Bulk Selection Handlers:**
```typescript
const toggleProductSelection = (productId: string) => {
  const newSelected = new Set(selectedProducts);
  if (newSelected.has(productId)) {
    newSelected.delete(productId);
  } else {
    newSelected.add(productId);
  }
  setSelectedProducts(newSelected);
  setShowBulkActions(newSelected.size > 0);
};

const toggleSelectAll = () => {
  if (selectedProducts.size === filteredProducts.length) {
    setSelectedProducts(new Set());
    setShowBulkActions(false);
  } else {
    const allIds = new Set(filteredProducts.map(p => p.id));
    setSelectedProducts(allIds);
    setShowBulkActions(true);
  }
};

const handleBulkStatusUpdate = async (isActive: boolean) => {
  if (selectedProducts.size === 0) return;
  
  try {
    const updates = Array.from(selectedProducts).map(id =>
      supabase
        .from('shop_products')
        .update({ is_active: isActive })
        .eq('id', id)
    );
    
    await Promise.all(updates);
    setSuccess(\`Updated \${selectedProducts.size} products successfully\`);
    setSelectedProducts(new Set());
    setShowBulkActions(false);
    await loadData();
  } catch (err) {
    console.error('Error updating products:', err);
    setError('Failed to update products');
  }
};
```

4. **Replace Image URL Input Section (in modal, around line 854):**
Replace this entire section:
```html
<div>
  <label className="block text-sm font-bold text-gray-700 mb-2">Product Image URL</label>
  <input
    type="url"
    value={formData.image_url}
    onChange={(e) => {
      setFormData({ ...formData, image_url: e.target.value });
      setImagePreview(e.target.value);
    }}
    placeholder="https://example.com/image.jpg"
    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
  />
  {imagePreview && (
    <div className="mt-3">
      <p className="text-sm font-bold text-gray-700 mb-2">Preview:</p>
      <img
        src={imagePreview}
        alt="Product preview"
        className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
        onError={() => setImagePreview('')}
      />
    </div>
  )}
  <p className="mt-2 text-xs text-gray-500">
    Note: For best results, use square images (1:1 aspect ratio)
  </p>
</div>
```

With:
```jsx
<div>
  <label className="block text-sm font-bold text-gray-700 mb-2">Product Image</label>
  <ImageUploadWithCrop
    currentImageUrl={formData.image_url}
    onImageUploaded={(url) => {
      setFormData({ ...formData, image_url: url });
      setImagePreview(url);
    }}
  />
  <div className="mt-3">
    <label className="block text-sm font-bold text-gray-700 mb-2">Or paste image URL:</label>
    <input
      type="url"
      value={formData.image_url}
      onChange={(e) => {
        setFormData({ ...formData, image_url: e.target.value });
        setImagePreview(e.target.value);
      }}
      placeholder="https://example.com/image.jpg"
      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none font-medium"
    />
  </div>
</div>
```

5. **Add Checkbox Column in Table Header (line ~589):**
```jsx
<th className="text-center px-6 py-4 text-sm font-bold text-gray-900 w-12">
  <input
    type="checkbox"
    checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
    onChange={toggleSelectAll}
    className="w-4 h-4 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
  />
</th>
```

6. **Add Checkbox Column in Table Body (line ~659):**
```jsx
<td className="px-6 py-4 text-center">
  <input
    type="checkbox"
    checked={selectedProducts.has(product.id)}
    onChange={() => toggleProductSelection(product.id)}
    className="w-4 h-4 text-blue-600 border-2 border-gray-300 rounded focus:ring-blue-500"
  />
</td>
```

7. **Add Bulk Actions Bar (before closing </div> of main container):**
```jsx
{showBulkActions && (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border-2 border-gray-300 p-4 flex items-center gap-4 z-50">
    <span className="font-bold text-gray-900">
      {selectedProducts.size} selected
    </span>
    <div className="h-6 w-px bg-gray-300" />
    <button
      onClick={() => handleBulkStatusUpdate(true)}
      className="px-4 py-2 bg-green-50 text-green-600 rounded-lg font-bold hover:bg-green-100"
    >
      Set Visible
    </button>
    <button
      onClick={() => handleBulkStatusUpdate(false)}
      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200"
    >
      Set Hidden
    </button>
    <button
      onClick={() => {
        setSelectedProducts(new Set());
        setShowBulkActions(false);
      }}
      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold hover:bg-red-100"
    >
      Cancel
    </button>
  </div>
)}
```

### PRIORITY 2: Create CSS for React Image Crop

**Location:** `src/index.css` (add to end of file)

```css
/* React Image Crop Styles */
.ReactCrop {
  position: relative;
  display: inline-block;
  cursor: crosshair;
  overflow: hidden;
  max-width: 100%;
}

.ReactCrop:focus {
  outline: none;
}

.ReactCrop__image {
  display: block;
  max-width: 100%;
  touch-action: manipulation;
}

.ReactCrop__crop-selection {
  position: absolute;
  top: 0;
  left: 0;
  transform: translate3d(0, 0, 0);
  box-sizing: border-box;
  cursor: move;
  box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.5);
  touch-action: none;
  border: 1px solid rgba(255, 255, 255, 0.9);
}

.ReactCrop__drag-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.3);
}

.ReactCrop__drag-handle::after {
  position: absolute;
  content: '';
  display: block;
  width: 30px;
  height: 30px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.ReactCrop__drag-handle--n {
  top: 0;
  left: 50%;
  margin-left: -5px;
  margin-top: -5px;
  cursor: ns-resize;
}

.ReactCrop__drag-handle--e {
  right: 0;
  top: 50%;
  margin-right: -5px;
  margin-top: -5px;
  cursor: ew-resize;
}

.ReactCrop__drag-handle--s {
  bottom: 0;
  left: 50%;
  margin-bottom: -5px;
  margin-left: -5px;
  cursor: ns-resize;
}

.ReactCrop__drag-handle--w {
  left: 0;
  top: 50%;
  margin-left: -5px;
  margin-top: -5px;
  cursor: ew-resize;
}

.ReactCrop__drag-handle--ne {
  top: 0;
  right: 0;
  margin-top: -5px;
  margin-right: -5px;
  cursor: nesw-resize;
}

.ReactCrop__drag-handle--se {
  right: 0;
  bottom: 0;
  margin-right: -5px;
  margin-bottom: -5px;
  cursor: nwse-resize;
}

.ReactCrop__drag-handle--sw {
  bottom: 0;
  left: 0;
  margin-bottom: -5px;
  margin-left: -5px;
  cursor: nesw-resize;
}

.ReactCrop__drag-handle--nw {
  top: 0;
  left: 0;
  margin-top: -5px;
  margin-left: -5px;
  cursor: nwse-resize;
}

.ReactCrop--disabled .ReactCrop__drag-handle {
  cursor: inherit;
}
```

### PRIORITY 3: Create Supabase Storage Bucket

**Action:** Run in Supabase SQL Editor or through dashboard:

```sql
-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy to allow public read
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'product-images' );

-- Allow authenticated users to delete
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'product-images' );
```

---

## Remaining Implementation Files

I'll continue creating the enhanced components for sections 4, 5, and 6 in the next responses.

Would you like me to:
1. Create the enhanced CMSCustomers component?
2. Create the enhanced CMSStaff component?
3. Create the enhanced CMSRewards component?
4. Create helper components for scan history?

Let me know which priority to tackle next!
