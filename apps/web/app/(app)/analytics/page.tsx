import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { InsightsTabs } from "@/components/insights-tabs";
import { PageHeader } from "@/components/page-header";
import { ProGate } from "@/components/upgrade-prompt";

export const metadata = { title: "Analytics — dayotter" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Analytics"
        description="How your booking pages convert — views, bookings, cancellations, and revenue."
      />
      <InsightsTabs />
      <ProGate feature="analytics">
        <AnalyticsDashboard />
      </ProGate>
    </div>
  );
}
