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
  type BookingEmailData,
} from "./templates";
