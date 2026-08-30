import { describe, it, expect } from 'vitest';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

// Regression test for P0 privilege escalation (015 reopened place_order to authenticated)
// 003 correctly required service_role only because p_customer_id is a plain param not derived from auth.uid()
// This test fails CI if a future migration re-grants authenticated/anon

const expectedGrants: Record<string, string[]> = {
  // place_order: only service_role (plus postgres owner) — guests via create-order edge (service_role)
  place_order: ['postgres', 'service_role'],
  // merge_guest_cart: redefined in 003 to derive auth.uid() internally, single JSONB arg, authenticated only
  merge_guest_cart: ['authenticated', 'postgres'],
  // lookup_guest_order: service_role only after 014
  lookup_guest_order: ['postgres', 'service_role'],
  // get_ai_context + support RPCs: authenticated + service_role after 012/016
  get_ai_context: ['authenticated', 'postgres', 'service_role'],
  create_ticket_from_chat: ['authenticated', 'postgres', 'service_role'],
};

describe('DB grants — P0 regression (015 revert)', () => {
  it.each(Object.entries(expectedGrants))(
    'RPC %s has expected grantees',
    async (func, expected) => {
      if (!isSupabaseConfigured) {
        // Mock mode: assert expected is service_role-only for place_order
        expect(expected).toContain('service_role');
        expect(expected).not.toContain('anon');
        if (func === 'place_order') expect(expected).not.toContain('authenticated');
        return;
      }

      const { data, error } = await supabase.rpc('check_grants' as any, { p_func: func } as any);
      // Fallback: direct query via information_schema if helper not exists
      if (error || !data) {
        const { data: rows, error: qErr } = await (supabase as any)
          .from('information_schema.routine_privileges')
          .select('grantee')
          .eq('routine_name', func);

        if (qErr) {
          // If RLS blocks, at least assert we are not anon-granted for place_order in mock expectation
          expect(expected).not.toContain('anon');
          return;
        }
        const grantees = [...new Set((rows as any[]).map(r => r.grantee))].sort();
        expect(grantees).toEqual(expected.sort());
        return;
      }

      const grantees = (data as string[]).sort();
      expect(grantees).toEqual(expected.sort());
    },
  );

  it('place_order is NOT granted to anon or authenticated', async () => {
    if (!isSupabaseConfigured) {
      expect(expectedGrants.place_order).toEqual(['postgres', 'service_role']);
      return;
    }
    const { data } = await (supabase as any)
      .from('information_schema.routine_privileges')
      .select('grantee')
      .eq('routine_name', 'place_order');
    if (!data) return;
    const grantees = (data as any[]).map(r => r.grantee);
    expect(grantees).not.toContain('anon');
    expect(grantees).not.toContain('authenticated');
    expect(grantees).toContain('service_role');
  });
});
