import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, SUPABASE_ANON_KEY } from '../lib/supabase';
import { API_ENDPOINTS } from '../lib/apiEndpoints';

async function readJsonError(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  const data = await response.json().catch(() => ({}));
  return typeof data?.error === 'string' && data.error ? data.error : null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    meta?: Record<string, any>,
  ) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const initSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (error) {
        console.error('Failed to get session:', error);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    const checkAdmin = async () => {
      try {
        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!cancelled) setIsAdmin(!!data);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to check admin status:', error);
          setIsAdmin(false);
        }
      }
    };
    checkAdmin();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const signUp: AuthContextValue['signUp'] = async (email, password, firstName, lastName, meta) => {
    if (!isSupabaseConfigured) {
      return {
        error:
          'Authentication is not configured. Set VITE_SUPABASE_URL and your_removed_credential_here.',
      };
    }

    const fallbackSignUp = async () => {
      const userData = { first_name: firstName, last_name: lastName, ...(meta ?? {}) };
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: userData },
      });
      return { error: error?.message ?? null };
    };

    try {
      const response = await fetch(API_ENDPOINTS.AUTH_SIGN_UP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, password, firstName, lastName, meta }),
      });

      if (response.ok) {
        // Edge function created the account (email confirmation flow —
        // Register UI shows "Check Your Email"; no browser session yet).
        return { error: null };
      }

      if (response.status === 429) {
        const edgeError = await readJsonError(response);
        return { error: edgeError || 'Too many registration attempts. Please try again later.' };
      }

      const edgeError = await readJsonError(response);
      if (edgeError) return { error: edgeError };

      // Non-JSON / unexpected response (e.g. edge function not deployed) → direct signUp
      return await fallbackSignUp();
    } catch {
      return await fallbackSignUp();
    }
  };

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    if (!isSupabaseConfigured) {
      return {
        error:
          'Authentication is not configured. Set VITE_SUPABASE_URL and your_removed_credential_here.',
      };
    }

    const directSignIn = async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    };

    try {
      const response = await fetch(API_ENDPOINTS.AUTH_SIGN_IN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.status === 429) {
        const edgeError = await readJsonError(response);
        return { error: edgeError || 'Too many login attempts. Please try again later.' };
      }

      if (response.ok) {
        // Edge validated credentials under rate limits; establish the browser
        // session with the client SDK (edge session is server-side only).
        return await directSignIn();
      }

      const edgeError = await readJsonError(response);
      if (edgeError) return { error: edgeError };

      return await directSignIn();
    } catch {
      return await directSignIn();
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const requestPasswordReset: AuthContextValue['requestPasswordReset'] = async email => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthContextValue['updatePassword'] = async newPassword => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAdmin,
        loading,
        signUp,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
