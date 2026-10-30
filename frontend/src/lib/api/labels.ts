import { apiClient } from './client';
import type {
  Label,
  CreateLabelPayload,
  UpdateLabelPayload,
} from '@/types/organization';

export const labelsApi = {
  getLabels: (categoryId?: string) =>
    apiClient.get<Label[]>('/labels', {
      params: categoryId ? { categoryId } : undefined,
    }),
  getLabel: (id: string) => apiClient.get<Label>(`/labels/${id}`),
  createLabel: (data: CreateLabelPayload) => apiClient.post<Label>('/labels', data),
  updateLabel: (id: string, data: UpdateLabelPayload) =>
    apiClient.patch<Label>(`/labels/${id}`, data),
  deleteLabel: (id: string) => apiClient.delete<Label>(`/labels/${id}`),
};
