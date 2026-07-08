/**
 * WorkLedger - Signature Canvas Component (PASSIVE EVENT FIX)
 * 
 * FIXES:
 * 1. Canvas cleared after delete ✅
 * 2. Canvas re-initialized after delete (fixes touch offset) ✅
 * 3. Passive event listener warning COMPLETELY FIXED ✅
 * 
 * @module components/attachments/SignatureCanvas
 * @created February 2, 2026 - Session 15
 * @updated February 4, 2026 - Fixed passive event listener warning
 */

import React, { useRef, useState, useEffect } from 'react';
import { attachmentService } from '../../services/api/attachmentService';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

export default function SignatureCanvas({
  workEntryId,
  fieldId,
  value,
  onChange,
  disabled = false
}) {
  // State
  const [isDrawing, setIsDrawing] = useState(false);
  const [signature, setSignature] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(true);

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  /**
   * Load existing signature
   */
  useEffect(() => {
    if (value && workEntryId) {
      loadSignature();
    }
  }, [value, workEntryId]);

  /**
   * Setup canvas size
   */
  useEffect(() => {
    if (canvasRef.current && containerRef.current) {
      resizeCanvas();
    }

    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  /**
   * Re-initialize canvas when switching from image back to canvas
   */
  useEffect(() => {
    if (!signature && canvasRef.current) {
      setTimeout(() => {
        resizeCanvas();
      }, 50);
    }
  }, [signature]);

  /**
   * ✅ Add native touch event listeners with passive: false
   * This prevents the "Unable to preventDefault" warning
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Touch event handlers
    const handleTouchStart = (e) => {
      if (disabled || signature) {
        return;
      }
      e.preventDefault(); // This now works because passive: false
      startDrawing(e);
    };

    const handleTouchMove = (e) => {
      if (!isDrawing || disabled || signature) {
        return;
      }
      e.preventDefault(); // This now works because passive: false
      draw(e);
    };

    const handleTouchEnd = () => {
      stopDrawing();
    };

    // Add listeners with { passive: false }
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Cleanup
    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [disabled, signature, isDrawing]);

  /**
   * Resize canvas to container width
   */
  const resizeCanvas = () => {
    if (!canvasRef.current || !containerRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    const width = container.clientWidth;
    const height = 200;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    console.log('🎨 Canvas resized:', { width, height });
  };

  /**
   * Load signature from database
   */
  const loadSignature = async () => {
    try {
      setLoading(true);
      const result = await attachmentService.getAttachments(workEntryId, fieldId);
      
      if (result.success && result.data.length > 0) {
        setSignature(result.data[0]);
        setIsEmpty(false);
      }
    } catch (err) {
      console.error('Failed to load signature:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get coordinates from event (mouse or touch)
   */
  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    if (event.touches) {
      return {
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
  };

  /**
   * Start drawing
   */
  const startDrawing = (event) => {
    if (disabled || signature) {
      return;
    }

    setIsDrawing(true);
    setIsEmpty(false);

    const coords = getCoordinates(event);
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  /**
   * Draw
   */
  const draw = (event) => {
    if (!isDrawing || disabled || signature) {
      return;
    }

    const coords = getCoordinates(event);
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  /**
   * Stop drawing
   */
  const stopDrawing = () => {
    setIsDrawing(false);
  };

  /**
   * Clear canvas
   */
  const handleClear = () => {
    if (signature) {
      if (window.confirm('Delete saved signature?')) {
        deleteSignature();
      }
    } else {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
    }
  };

  /**
   * Save signature
   */
  const handleSave = async () => {
    if (isEmpty || disabled || signature) {
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const canvas = canvasRef.current;

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      const file = new File([blob], 'signature.png', { type: 'image/png' });

      console.log('📤 Uploading signature...');
      const result = await attachmentService.uploadAttachment(
        workEntryId,
        file,
        fieldId,
        'signature'
      );

      if (result.success) {
        console.log('✅ Signature uploaded:', result.data.id);
        setSignature(result.data);
        
        if (onChange) {
          onChange(result.data.id);
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setIsEmpty(true);

      } else {
        console.error('❌ Upload failed:', result.error);
        setError(`Upload failed: ${result.error}`);
      }

    } catch (err) {
      console.error('❌ Error saving signature:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Delete signature
   */
  const deleteSignature = async () => {
    if (!signature) {
      return;
    }

    try {
      setLoading(true);

      const result = await attachmentService.deleteAttachment(signature.id);

      if (result.success) {
        setSignature(null);
        setIsEmpty(true);
        
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          console.log('🧹 Canvas cleared after signature delete');
        }

        setTimeout(() => {
          resizeCanvas();
          console.log('🔄 Canvas re-initialized after delete');
        }, 100);

        if (onChange) {
          onChange(null);
        }

        console.log('✅ Signature deleted, canvas cleared and re-initialized');
      } else {
        setError(`Delete failed: ${result.error}`);
      }

    } catch (err) {
      console.error('❌ Error deleting signature:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Canvas or Saved Signature */}
      <div ref={containerRef} className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
        {signature ? (
          // Show saved signature
          <div className="relative">
            <img
              src={signature.storage_url}
              alt="Signature"
              className="w-full h-auto"
            />
            {!disabled && (
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="bg-red-600 text-white rounded-lg px-3 py-1 text-sm hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          // Show canvas for drawing
          // ✅ Use ONLY mouse events here, touch events added via useEffect
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full touch-none cursor-crosshair"
            style={{ height: '200px' }}
          />
        )}
      </div>

      {/* Instructions */}
      {!signature && !disabled && (
        <p className="text-sm text-gray-600">
          Draw your signature above using mouse or touch
        </p>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* Uploading Indicator */}
      {uploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <p className="text-sm text-blue-900">Saving signature...</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!signature && !disabled && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            disabled={isEmpty || uploading}
          >
            Clear
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isEmpty || uploading}
          >
            Save Signature
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
