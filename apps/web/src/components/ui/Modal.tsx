'use client';
import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  hideCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  hideCloseButton = false,
  closeOnOverlayClick = true,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeOnOverlayClick ? onClose : () => undefined}
      />
      <div className="relative bg-surface rounded-card shadow-xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-xl font-semibold text-text-primary font-display">{title}</h2>}
          {!hideCloseButton && (
            <button onClick={onClose} className="text-text-muted hover:text-text-primary ml-auto">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div>{children}</div>
        {footer && <div className="mt-6 flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  );
}
