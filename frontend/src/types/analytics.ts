export interface DailyBreakdownItem {
  date: string; // "YYYY-MM-DD"
  focusSeconds: number;
  sessionsCount: number;
}

export interface AnalyticsSummary {
  totalFocusSeconds: number;
  completedSessionsCount: number;
  interruptedSessionsCount: number;
  totalSessionsCount: number;
  averageSessionSeconds: number;
  dailyBreakdown: DailyBreakdownItem[];
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  color: string;
  totalSeconds: number;
  sessionCount: number;
}

export interface LabelBreakdownItem {
  labelId: string;
  labelName: string;
  color: string;
  totalSeconds: number;
  sessionCount: number;
}

export interface QueryAnalyticsParams {
  startDate?: string;
  endDate?: string;
}
