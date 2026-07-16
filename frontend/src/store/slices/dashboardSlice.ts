import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Client-only customizable dashboard: an ordered list of widgets the user can
 * add / remove / reorder. Each widget renders from the existing live workspace
 * stats — no new data, just a configurable layout over it.
 */
export type WidgetType =
  | 'kpi_projects'
  | 'kpi_tasks'
  | 'kpi_completed'
  | 'kpi_overdue'
  | 'completion_ring'
  | 'created_trend'
  | 'status_distribution'
  | 'team_workload'
  | 'recent_activity'
  | 'time_tracked'
  | 'my_tasks';

export interface Widget {
  id: string;
  type: WidgetType;
}

export interface DashboardState {
  widgets: Widget[];
}

const DEFAULT_TYPES: WidgetType[] = [
  'kpi_projects',
  'kpi_tasks',
  'kpi_completed',
  'kpi_overdue',
  'completion_ring',
  'created_trend',
  'status_distribution',
  'team_workload',
  'recent_activity',
];

const makeDefault = (): Widget[] => DEFAULT_TYPES.map((type, i) => ({ id: `w-${i}-${type}`, type }));

const initialState: DashboardState = { widgets: makeDefault() };

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    addWidget: {
      reducer(state, action: PayloadAction<Widget>) {
        state.widgets.push(action.payload);
      },
      prepare(type: WidgetType) {
        return { payload: { id: `w-${nanoid(6)}`, type } satisfies Widget };
      },
    },
    removeWidget(state, action: PayloadAction<string>) {
      state.widgets = state.widgets.filter((w) => w.id !== action.payload);
    },
    moveWidget(state, action: PayloadAction<{ id: string; dir: -1 | 1 }>) {
      const i = state.widgets.findIndex((w) => w.id === action.payload.id);
      const j = i + action.payload.dir;
      if (i < 0 || j < 0 || j >= state.widgets.length) return;
      [state.widgets[i], state.widgets[j]] = [state.widgets[j], state.widgets[i]];
    },
    resetWidgets(state) {
      state.widgets = makeDefault();
    },
  },
});

export const { addWidget, removeWidget, moveWidget, resetWidgets } = dashboardSlice.actions;
export default dashboardSlice.reducer;
