'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type EvidenceListData,
  type GapListData,
  type MatchEvaluationData,
  type RequirementListData,
  fetchMatchEvaluation,
  fetchMatchGaps,
  fetchCriterionRequirements,
  fetchRequirementEvidence,
} from '../api/matchEvaluationClient';

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('auth_token') || localStorage.getItem('access_token') || '';
}

interface UseMatchEvaluationReturn {
  evaluation: MatchEvaluationData | null;
  evaluationState: LoadingState;
  evaluationError: string | null;
  refetchEvaluation: () => void;
  gaps: GapListData | null;
  gapsState: LoadingState;
  fetchGaps: () => void;
  fetchRequirements: (criterionId: string, page?: number) => Promise<RequirementListData | null>;
  requirementsCache: Record<string, RequirementListData>;
  fetchEvidence: (requirementId: string) => Promise<EvidenceListData | null>;
  evidenceCache: Record<string, EvidenceListData>;
}

export function useMatchEvaluation(matchId: string | null): UseMatchEvaluationReturn {
  const [evaluation, setEvaluation] = useState<MatchEvaluationData | null>(null);
  const [evaluationState, setEvalState] = useState<LoadingState>('idle');
  const [evaluationError, setEvalError] = useState<string | null>(null);
  const [gaps, setGaps] = useState<GapListData | null>(null);
  const [gapsState, setGapsState] = useState<LoadingState>('idle');
  const reqCacheRef = useRef<Record<string, RequirementListData>>({});
  const evCacheRef = useRef<Record<string, EvidenceListData>>({});
  const [requirementsCache, setReqCache] = useState<Record<string, RequirementListData>>({});
  const [evidenceCache, setEvCache] = useState<Record<string, EvidenceListData>>({});

  const doFetch = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) {
      setEvalError('Bạn cần đăng nhập.');
      setEvalState('error');
      return;
    }
    setEvalState('loading');
    setEvalError(null);
    try {
      const data = await fetchMatchEvaluation(id, token);
      setEvaluation(data);
      setEvalState('success');
    } catch (e: unknown) {
      setEvalError(e instanceof Error ? e.message : 'Không thể tải kết quả.');
      setEvalState('error');
    }
  }, []);

  useEffect(() => {
    if (!matchId) {
      setEvaluation(null);
      setEvalState('idle');
      setEvalError(null);
      setGaps(null);
      setGapsState('idle');
      reqCacheRef.current = {};
      evCacheRef.current = {};
      setReqCache({});
      setEvCache({});
      return;
    }
    doFetch(matchId);
  }, [matchId, doFetch]);

  const refetchEvaluation = useCallback(() => {
    if (matchId) doFetch(matchId);
  }, [matchId, doFetch]);

  const fetchGaps = useCallback(async () => {
    if (!matchId) return;
    const token = getToken();
    if (!token) return;
    setGapsState('loading');
    try {
      setGaps(await fetchMatchGaps(matchId, token));
      setGapsState('success');
    } catch {
      setGapsState('error');
    }
  }, [matchId]);

  const fetchRequirements = useCallback(
    async (criterionId: string, page = 1) => {
      const key = `${matchId}__${criterionId}__${page}`;
      if (reqCacheRef.current[key]) return reqCacheRef.current[key];
      if (!matchId) return null;
      const token = getToken();
      if (!token) return null;
      try {
        const data = await fetchCriterionRequirements(matchId, criterionId, token, page);
        reqCacheRef.current[key] = data;
        setReqCache({ ...reqCacheRef.current });
        return data;
      } catch {
        return null;
      }
    },
    [matchId],
  );

  const fetchEvidence = useCallback(
    async (requirementId: string) => {
      if (evCacheRef.current[requirementId]) return evCacheRef.current[requirementId];
      if (!matchId) return null;
      const token = getToken();
      if (!token) return null;
      try {
        const data = await fetchRequirementEvidence(matchId, requirementId, token);
        evCacheRef.current[requirementId] = data;
        setEvCache({ ...evCacheRef.current });
        return data;
      } catch {
        return null;
      }
    },
    [matchId],
  );

  return {
    evaluation,
    evaluationState,
    evaluationError,
    refetchEvaluation,
    gaps,
    gapsState,
    fetchGaps,
    fetchRequirements,
    requirementsCache,
    fetchEvidence,
    evidenceCache,
  };
}
