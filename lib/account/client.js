let instance = null;

export function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  if (!instance) {
    instance = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithOtp: async () => ({ error: null }),
        verifyOtp: async () => ({ data: { user: null, session: null }, error: null }),
        signOut: async () => ({ error: null }),
        setSession: async () => ({ data: { session: null }, error: null }),
        dispose: async () => {},
      },
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
          createSignedUrl: async () => ({ data: null, error: null }),
        }),
      },
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        upsert: () => Promise.resolve({ error: null }),
      }),
    };
  }
  return instance;
}
