/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

export interface ToastMessage {
  id?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

interface CounselorToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export default function CounselorToast(_props?: CounselorToastProps) {
  void _props;
  return null;
}

