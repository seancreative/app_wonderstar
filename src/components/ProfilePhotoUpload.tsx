import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Image } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ProfilePhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoUpdated: (url: string) => void;
}

const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({
  currentPhotoUrl,
  onPhotoUpdated,
}) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URL on unmount or when preview changes
  useEffect(() => {
    return () => {
      if (previewUrl) {
        console.log('[ProfilePhotoUpload] Cleaning up preview URL:', previewUrl);
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    console.log('[ProfilePhotoUpload] Validating file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeInKB: (file.size / 1024).toFixed(2) + ' KB',
      sizeInMB: (file.size / 1024 / 1024).toFixed(2) + ' MB'
    });

    if (!allowedTypes.includes(file.type)) {
      console.error('[ProfilePhotoUpload] Invalid file type:', file.type);
      return 'Please upload a JPEG, PNG, or WebP image';
    }

    if (file.size === 0) {
      console.error('[ProfilePhotoUpload] File is empty');
      return 'The selected file is empty. Please try again.';
    }

    console.log('[ProfilePhotoUpload] File validation passed');
    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      console.log('[ProfilePhotoUpload] No file selected or user not logged in', { file: !!file, user: !!user });
      return;
    }

    console.log('[ProfilePhotoUpload] File selected:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      isCamera: event.target === cameraInputRef.current
    });

    const validationError = validateFile(file);
    if (validationError) {
      console.error('[ProfilePhotoUpload] Validation failed:', validationError);
      setError(validationError);
      return;
    }

    try {
      // Clean up old preview URL if it exists
      if (previewUrl) {
        console.log('[ProfilePhotoUpload] Cleaning up old preview URL');
        URL.revokeObjectURL(previewUrl);
      }

      const objectUrl = URL.createObjectURL(file);
      console.log('[ProfilePhotoUpload] Preview URL created:', objectUrl);

      setError(null);
      setSelectedFile(file);
      setPreviewUrl(objectUrl);
      setShowOptions(false);
    } catch (err: any) {
      console.error('[ProfilePhotoUpload] Error creating preview:', err);
      setError('Failed to preview image. Please try again.');
    }
  };

  const handleOptionClick = (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      cameraInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
    setShowOptions(false);
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) {
      console.log('[ProfilePhotoUpload] Upload aborted - no file or user');
      return;
    }

    console.log('[ProfilePhotoUpload] Starting upload...', {
      fileName: selectedFile.name,
      fileType: selectedFile.type,
      fileSize: selectedFile.size
    });

    setUploading(true);
    setError(null);

    try {
      // Extract file extension from file type if name doesn't have it
      let fileExt = selectedFile.name.split('.').pop();

      // Fallback: if no extension or it's the full filename, use MIME type
      if (!fileExt || fileExt === selectedFile.name) {
        const mimeToExt: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp'
        };
        fileExt = mimeToExt[selectedFile.type] || 'jpg';
        console.log('[ProfilePhotoUpload] Using MIME type for extension:', fileExt);
      }

      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('[ProfilePhotoUpload] Uploading to storage:', { filePath, bucket: 'profile-photos' });

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('[ProfilePhotoUpload] Upload error:', uploadError);
        throw uploadError;
      }

      console.log('[ProfilePhotoUpload] Upload successful, getting public URL...');

      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      console.log('[ProfilePhotoUpload] Public URL obtained:', publicUrl);

      console.log('[ProfilePhotoUpload] Updating user record...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('[ProfilePhotoUpload] Database update error:', updateError);
        throw updateError;
      }

      console.log('[ProfilePhotoUpload] Upload complete!');
      onPhotoUpdated(publicUrl);

      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('[ProfilePhotoUpload] Upload failed:', err);
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    console.log('[ProfilePhotoUpload] Canceling upload');

    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    setShowOptions(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const displayUrl = previewUrl || currentPhotoUrl;

  return (
    <div className="text-center">
      <div className="relative inline-block">
        <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary-500 via-primary-600 to-pink-600 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-glow mb-4 overflow-hidden animate-pulse-glow">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{user?.name.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <button
          onClick={() => setShowOptions(!showOptions)}
          disabled={uploading}
          className="absolute bottom-4 right-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed border-4 border-white"
        >
          <Camera className="w-5 h-5" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {showOptions && !previewUrl && (
        <div className="mt-4 flex flex-col gap-2 max-w-xs mx-auto">
          <button
            onClick={() => handleOptionClick('camera')}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Take Photo
          </button>
          <button
            onClick={() => handleOptionClick('gallery')}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Image className="w-5 h-5" />
            Choose from Gallery
          </button>
          <button
            onClick={() => setShowOptions(false)}
            className="w-full py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      )}

      <p className="text-xs theme-text-secondary font-medium mt-2 max-w-xs mx-auto">
        Photo used for Face-ID entry, safety and emergency purposes only
      </p>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border-2 border-red-200 rounded-xl">
          <p className="text-sm text-red-600 font-bold">{error}</p>
        </div>
      )}

      {previewUrl && (
        <div className="mt-4 flex gap-2 justify-center">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button
            onClick={handleCancel}
            disabled={uploading}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfilePhotoUpload;
