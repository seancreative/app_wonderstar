import React, { useState, useRef, useCallback, useId } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Check, AlertCircle, Crop as CropIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ImageUploadWithCropProps {
  onImageUploaded: (url: string) => void;
  bucket?: string;
  folder?: string;
  currentImageUrl?: string;
}

const ImageUploadWithCrop: React.FC<ImageUploadWithCropProps> = ({
  onImageUploaded,
  bucket = 'product-images',
  folder = 'products',
  currentImageUrl
}) => {
  const uniqueId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImageSrc(reader.result?.toString() || '');
        setShowCropModal(true);
        setError('');
      });
      reader.readAsDataURL(file);
    }
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    const size = Math.min(width, height);
    const x = (width - size) / 2;
    const y = (height - size) / 2;

    const initialCrop = {
      unit: 'px' as const,
      width: size,
      height: size,
      x,
      y
    };

    setCrop(initialCrop);

    // Set completedCrop immediately so the upload button is enabled
    setCompletedCrop({
      unit: 'px',
      x,
      y,
      width: size,
      height: size
    });
  }, []);

  const getCroppedImg = useCallback((): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!completedCrop || !imgRef.current) {
        reject(new Error('No crop completed'));
        return;
      }

      const image = imgRef.current;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      
      canvas.width = 800;
      canvas.height = 800;

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        800,
        800
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  }, [completedCrop]);

  const handleUpload = async () => {
    if (!selectedFile || !completedCrop) {
      setError('Please crop the image first');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const croppedBlob = await getCroppedImg();
      const timestamp = Date.now();
      const cleanName = selectedFile.name.replace(/s+/g, '-');
      const fileName = `${folder}/${timestamp}-${cleanName}`;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onImageUploaded(publicUrl);
      setShowCropModal(false);
      setImageSrc('');
      setSelectedFile(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setShowCropModal(false);
    setImageSrc('');
    setSelectedFile(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onSelectFile}
          className="hidden"
          id={uniqueId}
        />
        <label
          htmlFor={uniqueId}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold hover:bg-blue-100 transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          Select Image
        </label>
        {currentImageUrl && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Check className="w-4 h-4 text-green-600" />
            Image uploaded
          </div>
        )}
      </div>

      {currentImageUrl && (
        <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-300">
          <img
            src={currentImageUrl}
            alt="Current product"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-800 font-semibold">{error}</p>
        </div>
      )}

      {showCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CropIcon className="w-5 h-5 text-blue-600" />
                <h3 className="text-xl font-black text-gray-900">Crop Image to Square</h3>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
                Adjust the crop area to select the part of the image you want to use. 
                The image will be cropped to a square (1:1 ratio) and resized to 800x800px.
              </p>
            </div>

            <div className="mb-6 flex justify-center bg-gray-100 rounded-lg p-4">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  style={{ maxHeight: '500px', maxWidth: '100%' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !completedCrop}
                className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save & Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploadWithCrop;