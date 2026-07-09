import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Analytics — calSync" };

export default function AnalyticsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Analytics"
        description="How your booking pages convert — views, bookings, cancellations, and revenue."
      />
      <AnalyticsDashboard />
    </div>
  );
}
