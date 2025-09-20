'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Profile = Tables<'profiles'>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  fallbackMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: Profile['role']) => boolean;
  isAdmin: boolean;
  isManagerOrAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const backgroundFetchRef = useRef<boolean>(false);
  const lastProcessedUserId = useRef<string | null>(null);


  const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<Profile | null> => {
    try {
      console.log(`[fetchProfile] Starting fetch for user: ${userId}, retry: ${retryCount}`);
      
      // Ensure we have a valid session before making the request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('[fetchProfile] No active session when fetching profile');
        return null;
      }

      console.log('[fetchProfile] Session found, making request...');
      
      // Add timeout to the Supabase request (reduced to 2 seconds for faster fallback)
      const requestPromise = supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      const timeoutPromise = new Promise<{ data: null; error: { message: 'Request timeout'; code?: string } }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: { message: 'Request timeout', code: 'TIMEOUT' } }), 2000) // 2 second timeout
      );
      
      const { data, error } = await Promise.race([requestPromise, timeoutPromise]);
      console.log('[fetchProfile] Profile fetch result:', { data, error });
      
      if (error) {
        console.error('[fetchProfile] Error fetching profile:', error);
        
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116' || error.message?.includes('No rows found')) {
          console.log('[fetchProfile] Profile not found, attempting to create one...');
          const newProfile = await createProfile(userId, session.user.email || '');
          console.log('[fetchProfile] Created profile:', newProfile);
          
          // If profile creation failed, return fallback profile
          if (!newProfile) {
            console.log('[fetchProfile] Profile creation failed, using fallback profile');
            return {
              id: userId,
              user_id: userId,
              email: session.user.email || '',
              display_name: session.user.email?.split('@')[0] || 'User',
              role: 'user',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
          }
          
          return newProfile;
        }
        
        // Handle timeout or network errors - return fallback profile immediately
        if (error.message === 'Request timeout' || error.message?.includes('timeout') || error.message?.includes('network')) {
          console.warn('[fetchProfile] Request timed out or network error, using fallback profile');
          return {
            id: userId,
            user_id: userId,
            email: session.user.email || '',
            display_name: session.user.email?.split('@')[0] || 'User',
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        
        // Handle RLS policy errors
        if (error.code === '42501' || error.message?.includes('row-level security policy')) {
          console.warn('[fetchProfile] RLS policy error, using fallback profile');
          return {
            id: userId,
            user_id: userId,
            email: session.user.email || '',
            display_name: session.user.email?.split('@')[0] || 'User',
            role: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
        
        // Retry logic for other errors (only once)
        if (retryCount < 1 && (error.code === '406' || error.message?.includes('406'))) {
          console.log(`[fetchProfile] Retrying profile fetch (attempt ${retryCount + 1})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return await fetchProfile(userId, retryCount + 1);
        }
        
        // For other errors, return fallback profile instead of null
        console.warn('[fetchProfile] Profile fetch failed, using fallback profile:', error);
        return {
          id: userId,
          user_id: userId,
          email: session.user.email || '',
          display_name: session.user.email?.split('@')[0] || 'User',
          role: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      console.log('[fetchProfile] Successfully fetched profile:', data);
      return data;
    } catch (error) {
      console.error('[fetchProfile] Exception in fetchProfile:', error);
      // Return fallback profile instead of null to prevent crashes
      return {
        id: userId,
        user_id: userId,
        email: '',
        display_name: 'User',
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
  }, []);

  const createProfile = async (userId: string, email: string): Promise<Profile | null> => {
    try {
      console.log(`[createProfile] Creating profile for user: ${userId}, email: ${email}`);
      
      // Add timeout to the Supabase request (reduced to 2 seconds for faster fallback)
      const requestPromise = supabase
        .from('profiles')
        .insert({
          user_id: userId,
          email: email,
          display_name: email.split('@')[0],
          role: 'user' as const
        })
        .select()
        .single();
      
      const timeoutPromise = new Promise<{ data: null; error: { message: 'Request timeout'; code?: string } }>((resolve) => 
        setTimeout(() => resolve({ data: null, error: { message: 'Request timeout', code: 'TIMEOUT' } }), 2000) // 2 second timeout
      );
      
      const { data, error } = await Promise.race([requestPromise, timeoutPromise]);
      console.log('[createProfile] Create profile result:', { data, error });
      
      if (error) {
        console.error('[createProfile] Error creating profile:', error);
        
        // Handle timeout or network errors
        if (error.message === 'Request timeout' || error.message?.includes('timeout') || error.message?.includes('network')) {
          console.warn('[createProfile] Request timed out or network error');
        }
        
        return null;
      }
      
      console.log('[createProfile] Successfully created profile:', data);
      return data;
    } catch (error) {
      console.error('[createProfile] Exception in createProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    // 페이지 가시성 변경 감지 (탭 전환 시)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('페이지가 다시 활성화됨, 세션 상태 확인 중...');
        // 탭이 다시 활성화될 때 세션 상태 확인
        supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (error) {
            console.error('세션 확인 중 오류:', error);
            return;
          }
          
          // 현재 user 상태를 직접 참조하지 않고 session을 기준으로 판단
          if (!session) {
            console.warn('세션이 만료됨, 로그아웃 처리');
            setUser(null);
            setSession(null);
            setProfile(null);
            setLoading(false);
            setInitialized(true);
          } else if (session.user.id !== lastProcessedUserId.current) {
            console.warn('다른 사용자로 세션 변경됨');
            setUser(session.user);
            setSession(session);
            lastProcessedUserId.current = session.user.id;
            backgroundFetchRef.current = false; // 리셋
            // 프로필 다시 로드
            if (!backgroundFetchRef.current) {
              backgroundFetchRef.current = true;
              const backgroundFetch = async () => {
                try {
                  const profileData = await fetchProfile(session.user.id);
                  if (profileData) {
                    setProfile(profileData);
                  } else {
                    const fallbackProfile = {
                      id: session.user.id,
                      user_id: session.user.id,
                      email: session.user.email || '',
                      display_name: session.user.email?.split('@')[0] || 'User',
                      role: 'user' as const,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    };
                    setProfile(fallbackProfile);
                  }
                } catch (error) {
                  console.error('프로필 재로드 실패:', error);
                }
              };
              setTimeout(backgroundFetch, 100);
            }
          }
        });
      }
    };

    // 페이지 가시성 변경 이벤트 리스너 등록
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        // Handle different auth events
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // 같은 사용자에 대한 중복 처리 방지
          if (session?.user && lastProcessedUserId.current === session.user.id) {
            console.log('Same user already processed, skipping...');
            setLoading(false);
            setInitialized(true);
            return;
          }
          
          console.log('Setting session and user...');
          setSession(session);
          setUser(session?.user ?? null);
          
          if (session?.user) {
            lastProcessedUserId.current = session.user.id;
            console.log('Setting up profile for user:', session.user.id);
            
            // 즉시 fallback 프로필 설정 (사용자 경험 개선)
            const fallbackProfile = {
              id: session.user.id,
              user_id: session.user.id,
              email: session.user.email || '',
              display_name: session.user.email?.split('@')[0] || 'User',
              role: 'user' as const,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            setProfile(fallbackProfile);
            console.log('Fallback profile set immediately:', fallbackProfile);
            
            // 백그라운드에서 실제 프로필 fetch (비동기) - 한 번만 실행
            if (!backgroundFetchRef.current) {
              backgroundFetchRef.current = true;
              const backgroundFetch = async () => {
                try {
                  console.log('Background profile fetch starting...');
                  const profileData = await fetchProfile(session.user.id);
                  
                  if (profileData) {
                    console.log('Background profile fetch successful, updating profile:', profileData);
                    setProfile(profileData);
                  } else {
                    console.log('Background profile fetch failed, keeping fallback profile');
                  }
                } catch (error) {
                  console.error('Background profile fetch error:', error);
                  // fallback 프로필 유지
                }
              };
              
              // 100ms 후 백그라운드 fetch 시작 (한 번만)
              setTimeout(backgroundFetch, 100);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('Signing out...');
          lastProcessedUserId.current = null;
          backgroundFetchRef.current = false; // 리셋
          setSession(null);
          setUser(null);
          setProfile(null);
        }
        
        console.log('Setting loading to false and marking as initialized');
        setLoading(false);
        setInitialized(true);
      }
    );

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // 초기화 시에도 중복 처리 방지
          if (lastProcessedUserId.current === session.user.id) {
            console.log('User already processed during initialization, skipping...');
            setLoading(false);
            setInitialized(true);
            return;
          }
          
          lastProcessedUserId.current = session.user.id;
          console.log('Setting up profile during initialization for user:', session.user.id);
          
          // 즉시 fallback 프로필 설정 (사용자 경험 개선)
          const fallbackProfile = {
            id: session.user.id,
            user_id: session.user.id,
            email: session.user.email || '',
            display_name: session.user.email?.split('@')[0] || 'User',
            role: 'user' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          setProfile(fallbackProfile);
          console.log('Fallback profile set during initialization:', fallbackProfile);
          
          // 백그라운드에서 실제 프로필 fetch (비동기) - 한 번만 실행
          if (!backgroundFetchRef.current) {
            backgroundFetchRef.current = true;
            const backgroundFetchInit = async () => {
              try {
                console.log('Background profile fetch during initialization starting...');
                const profileData = await fetchProfile(session.user.id);
                
                if (profileData) {
                  console.log('Background profile fetch during initialization successful, updating profile:', profileData);
                  setProfile(profileData);
                } else {
                  console.log('Background profile fetch during initialization failed, keeping fallback profile');
                }
              } catch (error) {
                console.error('Background profile fetch during initialization error:', error);
                // fallback 프로필 유지
              }
            };
            
            // 100ms 후 백그라운드 fetch 시작 (한 번만)
            setTimeout(backgroundFetchInit, 100);
          }
        }
        
        setLoading(false);
        setInitialized(true);
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
        setInitialized(true);
        setFallbackMode(true);
      }
    };

    initializeAuth();

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProfile]); // user 의존성 제거

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // If there's an error, set loading to false immediately
      if (error) {
        setLoading(false);
      }
      
      return { error };
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: Profile['role']) => {
    if (!profile) return false;
    return profile.role === role || profile.role === 'admin';
  };

  const isAdmin = profile?.role === 'admin';
  const isManagerOrAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  const value = {
    user,
    session,
    profile,
    loading,
    initialized,
    fallbackMode,
    signIn,
    signUp,
    signOut,
    hasRole,
    isAdmin,
    isManagerOrAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}