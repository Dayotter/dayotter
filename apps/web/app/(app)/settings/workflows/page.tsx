import { redirect } from "next/navigation";

/** Workflows merged into the unified Automations page. Keep the URL working. */
export default function WorkflowsSettingsPage() {
  redirect("/settings/automations#messages");
}
