declare module '*.css';
declare module '*app.js';
declare module '../app.js';

interface Window {
  switchView?: (view: string) => void;
  __CAREER_API_BASE_URL__?: string;
  __CAREER_API_V2_BASE_URL__?: string;
  __CAREER_WS_HOST__?: string;
  google?: unknown;
}
