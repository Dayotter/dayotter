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
  meetingRecap,
  applyTemplateVars,
  WORKFLOW_VARIABLES,
  type BookingEmailData,
  type DailyBriefingData,
  type MeetingRecapData,
} from "./templates";
