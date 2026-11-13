import { useCallback, useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { supabase } from '../../lib/supabase';
interface Job {
  order_id: string;
  attempts: number;
  available_at: string;
  delivered_at: string | null;
  last_error: string | null;
}
export default function Notifications() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const { data, error: failure } = await supabase
      .from('order_notification_outbox')
      .select('order_id,attempts,available_at,delivered_at,last_error')
      .is('delivered_at', null)
      .order('available_at')
      .limit(100);
    setError(failure ? 'Could not load notifications. Try again.' : '');
    if (!failure) setJobs(data ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <AdminLayout>
      <h1 className="nv-heading text-4xl mb-4">Order notifications</h1>
      <p className="mb-4">
        Pending confirmations retry automatically. Repeated failures need an email service
        configuration check.
      </p>
      <button className="underline mb-4" onClick={() => void load()}>
        Refresh
      </button>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <ul>
          {jobs.map(job => (
            <li className="border-b py-3" key={job.order_id}>
              Order {job.order_id} · {job.attempts} attempts · Next attempt{' '}
              {new Date(job.available_at).toLocaleString()}
              {job.last_error && <p>{job.last_error}</p>}
            </li>
          ))}
        </ul>
      )}
      {!error && jobs.length === 0 && <p>No pending notifications.</p>}
    </AdminLayout>
  );
}
