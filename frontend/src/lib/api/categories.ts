import { apiClient } from './client';
import type {
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '@/types/organization';

export const categoriesApi = {
  getCategories: () => apiClient.get<Category[]>('/categories'),
  getCategory: (id: string) => apiClient.get<Category>(`/categories/${id}`),
  createCategory: (data: CreateCategoryPayload) => apiClient.post<Category>('/categories', data),
  updateCategory: (id: string, data: UpdateCategoryPayload) =>
    apiClient.patch<Category>(`/categories/${id}`, data),
  deleteCategory: (id: string) => apiClient.delete<Category>(`/categories/${id}`),
};
