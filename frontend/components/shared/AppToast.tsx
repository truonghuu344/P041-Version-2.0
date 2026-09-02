/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

export interface AppToastMessage {
  id?: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

interface AppToastProps {
  toast: AppToastMessage | null;
  onClose: () => void;
}

export default function AppToast(_props?: AppToastProps) {
  void _props;
  return null;
}

