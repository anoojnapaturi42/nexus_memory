export type DashboardTone = "neutral" | "success" | "warning" | "danger" | "info";

export type DashboardRow = {
  label: string;
  meta: string;
  tone: string;
  toneVariant?: DashboardTone;
};

export type DashboardWidgetData = {
  title: string;
  subtitle: string;
  accent: string;
};
