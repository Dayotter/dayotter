import { AutomationsForm } from "@/components/automations-form";
import { ProGate } from "@/components/upgrade-prompt";

export const dynamic = "force-dynamic";

export default function AutomationsSettingsPage() {
  return (
    <ProGate feature="automation">
      <AutomationsForm />
    </ProGate>
  );
}
