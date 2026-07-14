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
  dailyBriefing,
  applyTemplateVars,
  WORKFLOW_VARIABLES,
  type BookingEmailData,
  type DailyBriefingData,
} from "./templates";
