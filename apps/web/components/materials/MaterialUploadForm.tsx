'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';

interface UploadedMaterial {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  processingStatus: string;
}

interface MaterialUploadFormProps {
  onUploadSuccess?: (material: UploadedMaterial) => void;
  topicId?: string;
}

// Popular emojis for titles
const POPULAR_EMOJIS = [
  '📚', '📖', '✏️', '📝', '🎓', '💡',
  '⚡', '🔥', '✨', '🎯', '📊', '📈',
  '🧠', '🤔', '💻', '⚙️', '🔧', '🛠️',
  '🌟', '⭐', '👍', '💪', '🚀', '🎉'
];

// Separate component to avoid inline styles
// Note: Dynamic progress width requires inline style for real-time updates
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="progress-bar-fill h-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-all duration-300"
      style={{ width: `${progress}%` }}
    />
  );
}

export function MaterialUploadForm({ onUploadSuccess, topicId }: MaterialUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadedMaterial, setUploadedMaterial] = useState<UploadedMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload a PDF or image (JPG, PNG)');
      return;
    }

    // Validate file size (50MB)
    const maxSize = 50 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File is too large. Maximum size is 50MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const addEmoji = (emoji: string) => {
    setTitle(title + emoji);
    setShowEmojiPicker(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file || !title.trim()) {
      setError('Please select a file and enter a title');
      return;
    }

    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title.trim());
      if (topicId) {
        formData.append('topicId', topicId);
      }

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 201 || xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setUploadedMaterial(response);
          setFile(null);
          setTitle('');
          setProgress(0);
          onUploadSuccess?.(response);
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setError(errorData.message || 'Upload failed. Please try again.');
        }
        setLoading(false);
      });

      xhr.addEventListener('error', () => {
        setError('Network error. Please check your connection and try again.');
        setLoading(false);
      });

      xhr.open('POST', '/api/materials/upload');
      xhr.send(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
      setLoading(false);
    }
  };

  const shareToWhatsApp = () => {
    if (!uploadedMaterial) return;

    const message = encodeURIComponent(
      `📚 Check out this material I just shared in Vylix!\n\n${uploadedMaterial.title}\n\n🔗 ${window.location.origin}/materials/${uploadedMaterial.id}`
    );

    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  if (uploadedMaterial) {
    return (
      <Card elevated className="cp-fade-up">
        <CardHeader
          title="Upload Successful!"
          description="Your material is now being processed"
        />
        <CardBody>
          <div className="space-y-2">
            <p className="cp-body-sm">
              <span className="font-semibold">File:</span> {uploadedMaterial.fileName}
            </p>
            <p className="cp-body-sm">
              <span className="font-semibold">Status:</span>{' '}
              <span className="badge badge-primary">{uploadedMaterial.processingStatus}</span>
            </p>
          </div>
        </CardBody>
        <CardFooter>
          <Button
            variant="primary"
            onClick={shareToWhatsApp}
            icon="📱"
          >
            Share to WhatsApp
          </Button>
          <Button
            variant="secondary"
            onClick={() => setUploadedMaterial(null)}
          >
            Upload Another
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="cp-fade-up">
      <CardHeader
        title="Upload Study Material"
        description="Share PDFs, lecture notes, or study guides with your class"
      />
      <form onSubmit={handleUpload}>
        <CardBody>
          {/* Title Input */}
          <div className="form-group required">
            <label htmlFor="title">Material Title</label>
            <div className="relative">
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Week 5 Lecture Notes"
                aria-label="Material title with optional emoji"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xl hover:bg-gray-100 rounded p-1 transition"
                title="Add emoji"
              >
                😊
              </button>
              {showEmojiPicker && (
                <div className="emoji-picker">
                  <div className="emoji-grid">
                    {POPULAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => addEmoji(emoji)}
                        className="emoji-item"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* File Upload */}
          <div className="form-group required">
            <label htmlFor="file-input">Select File</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer transition hover:border-blue-400 hover:bg-blue-50"
            >
              <input
                id="file-input"
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                aria-label="Upload PDF or image file"
              />

              {file ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">✓ {file.name}</p>
                  <p className="text-xs text-gray-600">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xl">📁</p>
                  <p className="font-semibold text-gray-900">Click to upload or drag and drop</p>
                  <p className="text-sm text-gray-600">PDF or image (JPG, PNG) • Max 50MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert type="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Progress Bar */}
          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Uploading...</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                <ProgressBar progress={progress} />
              </div>
            </div>
          )}
        </CardBody>

        <CardFooter>
          <Button
            type="submit"
            variant="primary"
            disabled={!file || !title.trim() || loading}
            isLoading={loading}
            className="flex-1"
          >
            Upload Material
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
