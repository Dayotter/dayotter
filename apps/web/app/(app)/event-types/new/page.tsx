import { EventTypeForm } from "@/components/event-type-form";
import { PageHeader } from "@/components/page-header";
import { paymentsEnabled } from "@/lib/payments/stripe";

export default function NewEventTypePage() {
  return (
    <>
      <PageHeader title="New event type" description="Define a meeting people can book." />
      <EventTypeForm mode="create" paymentsEnabled={paymentsEnabled} />
    </>
  );
}
