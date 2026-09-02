import { ApiClient } from '@/api-client.js';

describe('Centralized API Request Resilience & Deduplication', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    originalFetch = global.fetch;
    localStorage.clear();
    ApiClient.resetResilienceState();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllTimers();
    jest.useRealTimers();
    ApiClient.resetResilienceState();
  });

  describe('Deduplication of In-flight GET Requests', () => {
    test('deduplicates concurrent GET /cvs requests to a single fetch call', async () => {
      const mockFetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => [{ id: 'cv-1', title: 'Software Engineer CV' }],
              }),
            50,
          ),
        ),
      );
      global.fetch = mockFetch;

      const promise1 = ApiClient.listCVs();
      const promise2 = ApiClient.listCVs();
      const promise3 = ApiClient.listCVs();

      jest.advanceTimersByTime(60);

      const [res1, res2, res3] = await Promise.all([promise1, promise2, promise3]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res1).toEqual([{ id: 'cv-1', title: 'Software Engineer CV' }]);
      expect(res2).toEqual(res1);
      expect(res3).toEqual(res1);
    });

    test('deduplicates concurrent unread notification count requests', async () => {
      const mockFetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ unread_count: 3 }),
              }),
            50,
          ),
        ),
      );
      global.fetch = mockFetch;

      const promise1 = ApiClient.getNotificationUnreadCount();
      const promise2 = ApiClient.getNotificationUnreadCount();

      jest.advanceTimersByTime(60);

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res1).toEqual({ unread_count: 3 });
      expect(res2).toEqual({ unread_count: 3 });
    });
    test('deduplicates and caches GET /jobs/locations requests', async () => {
      const mockFetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ locations: ['Hà Nội', 'TP. Hồ Chí Minh'] }),
              }),
            50,
          ),
        ),
      );
      global.fetch = mockFetch;

      const p1 = ApiClient.listJobLocations();
      const p2 = ApiClient.listJobLocations();

      jest.advanceTimersByTime(60);

      const [res1, res2] = await Promise.all([p1, p2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res1).toEqual({ locations: ['Hà Nội', 'TP. Hồ Chí Minh'] });
      expect(res2).toEqual(res1);

      // Subsequent call within 60s uses cache
      const p3 = await ApiClient.listJobLocations();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(p3).toEqual(res1);
    });
  });

  describe('Deduplication of POST /api/v2/job-recommendations', () => {
    test('deduplicates concurrent job-recommendations requests with same payload', async () => {
      const mockFetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ status: 'COMPLETED', items: [{ job_id: 'job-1', title: 'Developer' }] }),
              }),
            50,
          ),
        ),
      );
      global.fetch = mockFetch;

      const p1 = ApiClient.recommendTopJobs('cv-123', { role: 'frontend' });
      const p2 = ApiClient.recommendTopJobs('cv-123', { role: 'frontend' });

      jest.advanceTimersByTime(60);

      const [res1, res2] = await Promise.all([p1, p2]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res1.items).toHaveLength(1);
      expect(res2).toEqual(res1);
    });
  });

  describe('Health Check Resilience & Deduplication', () => {
    test('only one health check is in-flight globally even when called simultaneously', async () => {
      const mockFetch = jest.fn().mockImplementation(() =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ status: 'healthy' }),
              }),
            50,
          ),
        ),
      );
      global.fetch = mockFetch;

      const h1 = ApiClient.checkHealth();
      const h2 = ApiClient.checkHealth();
      const h3 = ApiClient.checkHealth();

      jest.advanceTimersByTime(60);

      const [res1, res2, res3] = await Promise.all([h1, h2, h3]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(res1).toBe(true);
      expect(res2).toBe(true);
      expect(res3).toBe(true);
    });

    test('checkHealthOnce only triggers on initial authenticated run', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' }),
      });
      global.fetch = mockFetch;

      await ApiClient.checkHealthOnce();
      await ApiClient.checkHealthOnce();
      await ApiClient.checkHealthOnce();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Infrastructure Error Handling & Bounded Health Backoff', () => {
    test('503 Service Unavailable marks backend temporarily unavailable without logging out user', async () => {
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('user_info', JSON.stringify({ id: 'u1', role: 'student' }));

      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ detail: 'hibernate-wake-error' }),
      });
      global.fetch = mockFetch;

      await expect(ApiClient.listCVs()).rejects.toThrow();

      // User session must NOT be wiped by 503
      expect(localStorage.getItem('access_token')).toBe('test-token');
      expect(localStorage.getItem('user_info')).not.toBeNull();
      expect(ApiClient.isBackendHealthy()).toBe(false);

      // Subsequent business calls fast-fail with 503 without hitting fetch
      mockFetch.mockClear();
      await expect(ApiClient.listJDs()).rejects.toThrow(/tạm thời không khả dụng/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test('429 Rate Limit error preserves user session and does NOT mark backend unavailable', async () => {
      localStorage.setItem('access_token', 'test-token');
      localStorage.setItem('user_info', JSON.stringify({ id: 'u1', role: 'student' }));

      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ detail: 'Too many requests. Please retry shortly.' }),
      });
      global.fetch = mockFetch;

      await expect(ApiClient.listCVs()).rejects.toThrow();

      // User session must NOT be wiped by 429
      expect(localStorage.getItem('access_token')).toBe('test-token');
      expect(localStorage.getItem('user_info')).not.toBeNull();
      // 429 must NOT mark backend unavailable or trigger reconnection storm
      expect(ApiClient.isBackendHealthy()).toBe(true);
    });

    test('follows bounded backoff intervals (5s -> 10s -> 20s -> 30s cap) and resumes upon recovery', async () => {
      let healthCount = 0;
      const mockFetch = jest.fn().mockImplementation(async (url) => {
        if (url.includes('/health') || url.includes('/backend-health')) {
          healthCount++;
          // Health checks: fail first 3 times, succeed on 4th
          if (healthCount <= 3) {
            return {
              ok: false,
              status: 503,
              json: async () => ({ detail: 'unavailable' }),
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => ({ status: 'healthy' }),
          };
        }
        // First business request fails with 503 to trigger unavailability
        return {
          ok: false,
          status: 503,
          json: async () => ({ detail: 'unavailable' }),
        };
      });
      global.fetch = mockFetch;

      const readyListener = jest.fn();
      ApiClient.onBackendReady(readyListener);

      // Trigger outage
      await expect(ApiClient.listCVs()).rejects.toThrow();
      expect(ApiClient.isBackendHealthy()).toBe(false);

      // 1st health retry after 5s
      await jest.advanceTimersByTimeAsync(5000);
      expect(ApiClient.isBackendHealthy()).toBe(false);
      expect(healthCount).toBe(1);

      // 2nd health retry after 10s
      await jest.advanceTimersByTimeAsync(10000);
      expect(ApiClient.isBackendHealthy()).toBe(false);
      expect(healthCount).toBe(2);

      // 3rd health retry after 20s
      await jest.advanceTimersByTimeAsync(20000);
      expect(ApiClient.isBackendHealthy()).toBe(false);
      expect(healthCount).toBe(3);

      // 4th health retry after 30s -> succeeds!
      await jest.advanceTimersByTimeAsync(30000);

      expect(ApiClient.isBackendHealthy()).toBe(true);
      expect(healthCount).toBe(4);
      expect(readyListener).toHaveBeenCalledTimes(1);
    });

    test('401 error is an auth error, does NOT mark backend unavailable', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });
      global.fetch = mockFetch;

      await expect(ApiClient.listCVs()).rejects.toThrow();
      expect(ApiClient.isBackendHealthy()).toBe(true);
    });
  });
});
