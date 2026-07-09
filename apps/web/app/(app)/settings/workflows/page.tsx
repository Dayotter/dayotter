import { ProGate } from "@/components/upgrade-prompt";
import { WorkflowsForm } from "@/components/workflows-form";

export const dynamic = "force-dynamic";

export default function WorkflowsSettingsPage() {
  return (
    <ProGate feature="workflows">
      <WorkflowsForm />
    </ProGate>
  );
}
