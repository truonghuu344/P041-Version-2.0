declare module '*.css';
declare module '*app.js';
declare module '../app.js';
declare module 'react-dom';

interface Window {
  switchView?: (view: string) => void;
  openAuthModal?: () => void;
  __CAREER_API_BASE_URL__?: string;
  __CAREER_API_V2_BASE_URL__?: string;
  __CAREER_WS_HOST__?: string;
  __CAREER_VOICE_WS_BASE_URL__?: string;
  google?: any;
}
