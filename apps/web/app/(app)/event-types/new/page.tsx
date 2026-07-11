import { EventTypeForm } from "@/components/event-type-form";
import { PageHeader } from "@/components/page-header";
import { paymentsEnabled } from "@/lib/payments/stripe";

export default function NewEventTypePage() {
  return (
    <>
      <PageHeader title="New booking type" description="A link people use to grab time with you." />
      <EventTypeForm mode="create" paymentsEnabled={paymentsEnabled} />
    </>
  );
}
