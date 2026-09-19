/** W-16 deep link — every "Send message" entry point (Dashboard, Drivers, Driver profile, Live
 * Fleet) opens the driver's existing DIRECT conversation, or starts one, via `?driverId=`
 * (same param name as `/hos-logs?driverId=`). `MessagesPage` consumes it and then removes it from
 * the URL with `replace`. No driver ⇒ the plain page. */
export function messagesHref(driverId?: string | null): string {
  return driverId ? `/messages?${new URLSearchParams({ driverId }).toString()}` : '/messages';
}
