export function canRequestReturn(
  order: { customer_id: string | null; email: string },
  customerId: string | null,
  authenticatedEmail: string | undefined,
  guestVerified: boolean,
): boolean {
  if (order.customer_id) return customerId === order.customer_id;
  return (
    guestVerified ||
    (!!customerId &&
      !!authenticatedEmail &&
      authenticatedEmail.toLowerCase() === order.email.toLowerCase())
  );
}
