import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  const checkAdmin = async (userId: string) => {
    setRoleLoading(true);
    const { data } = await supabase
      .from('user_roles' as any)
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
    setRoleLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkAdmin(session.user.id);
      } else {
        setIsAdmin(false);
        setRoleLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        checkAdmin(session.user.id);
      } else {
        setRoleLoading(false);
      }
    });

    // Transient session: sign out if browser was closed and reopened
    const transient = sessionStorage.getItem('session_transient');
    if (!transient) {
      // If flag was in localStorage but not sessionStorage, user closed/reopened browser
      const wasTransient = localStorage.getItem('session_was_transient');
      if (wasTransient) {
        localStorage.removeItem('session_was_transient');
        supabase.auth.signOut();
      }
    } else {
      // Carry the flag so we can detect browser close
      localStorage.setItem('session_was_transient', 'true');
    }

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    sessionStorage.removeItem('session_transient');
    localStorage.removeItem('session_was_transient');
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut, isAdmin, roleLoading };
}
