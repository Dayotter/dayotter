import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { InsightsTabs } from "@/components/insights-tabs";
import { PageHeader } from "@/components/page-header";
import { ProGate } from "@/components/upgrade-prompt";

export const metadata = { title: "Analytics - DayOtter" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Analytics"
        description="How your booking pages convert - views, bookings, cancellations, and revenue."
      />
      <InsightsTabs />
      <ProGate feature="analytics">
        <AnalyticsDashboard />
      </ProGate>
    </>
  );
}
