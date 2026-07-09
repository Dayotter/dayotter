export { sendEmail, type OutboundEmail } from "./mailer";
export {
  bookingConfirmation,
  bookingReminder,
  bookingFollowUp,
  bookingNoShowFollowUp,
  bookingRescheduled,
  bookingCancellation,
  bookingRunningLate,
  bookingMessage,
  workflowEmail,
  applyTemplateVars,
  WORKFLOW_VARIABLES,
  type BookingEmailData,
} from "./templates";
