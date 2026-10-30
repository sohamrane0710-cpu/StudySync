import { apiClient } from './client';
import type {
  AnalyticsSummary,
  CategoryBreakdownItem,
  LabelBreakdownItem,
  QueryAnalyticsParams,
} from '@/types/analytics';

export const analyticsApi = {
  getSummary: (params?: QueryAnalyticsParams) =>
    apiClient.get<AnalyticsSummary>('/analytics/summary', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    }),
  getCategories: (params?: QueryAnalyticsParams) =>
    apiClient.get<CategoryBreakdownItem[]>('/analytics/categories', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    }),
  getLabels: (params?: QueryAnalyticsParams) =>
    apiClient.get<LabelBreakdownItem[]>('/analytics/labels', {
      params: params as Record<string, string | number | boolean | undefined | null>,
    }),
};
