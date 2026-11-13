import { isOrderNumber } from './order-number.ts';
Deno.test('tracking supports legacy numbers and growing sequence values', () => {
  for (const value of ['NRV-123456', 'NRV-1000000', 'NRV-9223372036854775807'])
    if (!isOrderNumber(value)) throw new Error(`Rejected ${value}`);
  for (const value of ['NRV-12345', 'NRV--123456', 'NRV-12345678901234567890', 'NRV-123456/other'])
    if (isOrderNumber(value)) throw new Error(`Accepted ${value}`);
});
