/** Compatibility exports: notifications and other consumers share the same auth boundary. */
export {
  readAuthenticatedAccount as readNotificationAccount,
  isCurrentAuthenticatedAccount as isCurrentNotificationAccount,
  subscribeAuthenticatedAccount as subscribeNotificationAccount,
  serverAuthenticatedAccount as serverNotificationAccount,
  type AuthenticatedAccount as NotificationAccount,
} from "@/lib/authenticated-account";
