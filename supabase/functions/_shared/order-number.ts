export function isOrderNumber(value: string): boolean {
  return /^NRV-[0-9]{6,19}$/.test(value);
}
