// import React, { createContext, useContext, useEffect, useState } from 'react';
// import { Session } from '@supabase/supabase-js';
// import { supabase } from '@/lib/supabase';

// interface AuthContextType {
//   session: Session | null;
//   loading: boolean;
//   signInWithPhone: (phone: string) => Promise<{ error: any }>;
//   verifyOtp: (phone: string, token: string) => Promise<{ error: any }>;
//   signOut: () => Promise<void>;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export function AuthProvider({ children }: { children: React.ReactNode }) {
//   const [session, setSession] = useState<Session | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     supabase.auth.getSession().then(({ data: { session } }) => {
//       setSession(session);
//       setLoading(false);
//     });

//     const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
//       (async () => {
//         setSession(session);

//         if (session?.user && _event === 'SIGNED_IN') {
//           const { data: profile } = await supabase
//             .from('profiles')
//             .select('id')
//             .eq('id', session.user.id)
//             .maybeSingle();

//           if (!profile) {
//             await supabase.from('profiles').insert({
//               id: session.user.id,
//               phone_number: session.user.phone || '',
//               display_name: session.user.phone || 'User',
//             });
//           }
//         }
//       })();
//     });

//     return () => subscription.unsubscribe();
//   }, []);

//   const signInWithPhone = async (phone: string) => {
//     const { error } = await supabase.auth.signInWithOtp({
//       phone,
//     });
//     return { error };
//   };

//   const verifyOtp = async (phone: string, token: string) => {
//     const { error } = await supabase.auth.verifyOtp({
//       phone,
//       token,
//       type: 'sms',
//     });
//     return { error };
//   };

//   const signOut = async () => {
//     await supabase.auth.signOut();
//   };

//   return (
//     <AuthContext.Provider
//       value={{
//         session,
//         loading,
//         signInWithPhone,
//         verifyOtp,
//         signOut,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// }


import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ensureDeviceKeys } from '@/lib/crypto/deviceKeys';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<{ error: any }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      
      // If user is already logged in, ensure they have device keys
      if (session?.user) {
        console.log('[AuthContext] Existing session found, checking device keys...');
        try {
          await ensureDeviceKeys(session.user.id, 'primary', {
            contact: session.user.email || session.user.phone || undefined,
            displayName: session.user.email?.split('@')[0] || undefined,
          });
          console.log('[AuthContext] Device keys ready');
        } catch (error) {
          console.error('[AuthContext] Failed to ensure device keys:', error);
        }
      }
      
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);

        if (session?.user && _event === 'SIGNED_IN') {
          console.log('[AuthContext] User signed in, initializing profile and device keys...');
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!profile) {
            const contact =
              session.user.email || session.user.phone || `user-${session.user.id}`;

            await supabase.from('profiles').insert({
              id: session.user.id,
              phone_number: contact,
              display_name: session.user.email?.split('@')[0] || contact,
            });
            console.log('[AuthContext] Profile created');
          }

          // Generate and publish device keys for end-to-end encryption
          try {
            console.log('[AuthContext] Generating device keys...');
            await ensureDeviceKeys(session.user.id, 'primary', {
              contact: session.user.email || session.user.phone || undefined,
              displayName: session.user.email?.split('@')[0] || undefined,
            });
            console.log('[AuthContext] Device keys generated and published');
          } catch (error) {
            console.error('[AuthContext] Failed to generate device keys:', error);
          }
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
    });
    return { error };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        signInWithEmail,
        verifyOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
