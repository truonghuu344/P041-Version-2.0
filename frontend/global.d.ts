declare module '*.css';
declare module '*app.js';
declare module '../app.js';

interface Window {
  switchView?: (view: string) => void;
  __CAREER_API_BASE_URL__?: string;
  google?: any;
}
