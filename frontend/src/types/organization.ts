export interface Category {
  id: string;
  userId: string;
  name: string;
  color: string; // e.g. #6366F1
  icon?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  labels?: Label[];
}

export interface Label {
  id: string;
  userId: string;
  name: string;
  color: string;
  categoryId?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  category?: Category | null;
}

export interface CreateCategoryPayload {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryPayload {
  name?: string;
  color?: string;
  icon?: string;
}

export interface CreateLabelPayload {
  name: string;
  color?: string;
  categoryId?: string;
}

export interface UpdateLabelPayload {
  name?: string;
  color?: string;
  categoryId?: string | null;
}
