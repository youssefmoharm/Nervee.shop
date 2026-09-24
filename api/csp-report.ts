import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelRequest = IncomingMessage & { body?: unknown };
type VercelResponse = ServerResponse & { status?: (code: number) => VercelResponse };

/**
 * Content-Security-Policy violation sink (report-uri /api/csp-report).
 *
 * Browsers POST violations here (application/csp-report or application/json).
 * We only log — CSP is enforced by the header itself; this endpoint exists so
 * violations are observable in Vercel function logs.
 */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end();
    return;
  }

  try {
    const body = req.body;
    let raw = '';
    if (typeof body === 'string') {
      raw = body;
    } else if (Buffer.isBuffer(body)) {
      raw = body.toString('utf8');
    } else if (body && typeof body === 'object') {
      raw = JSON.stringify(body);
    }
    // Cap log size — a hostile client must not flood function logs.
    console.log('[csp-report]', raw.slice(0, 2000) || '(empty body)');
  } catch (err) {
    console.warn('[csp-report] failed to parse report:', err);
  }

  res.statusCode = 204;
  res.end();
}
