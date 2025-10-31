'use client'

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogIn, AlertCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Tables } from "@/integrations/supabase/types";

type User = Tables<'users'>;

export default function BuyPage() {
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Check if user is already logged in
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUserId = localStorage.getItem('buy_user_id');
        if (storedUserId) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', storedUserId)
            .single();
          
          if (!error && data) {
            setUser(data);
          } else {
            localStorage.removeItem('buy_user_id');
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    
    loadUser();
  }, []);

  // Auto focus input when component mounts
  useEffect(() => {
    if (!user && inputRef.current) {
      inputRef.current.focus();
    } else if (user && !user.name && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [user]);

  // Validate mobile number format (010xxxxxxxx)
  const validateMobile = (phone: string): boolean => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it matches 010xxxxxxxx format (11 digits starting with 010)
    return /^010\d{8}$/.test(cleaned);
  };

  // Format mobile number for display (010-xxxx-xxxx)
  const formatMobile = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('010')) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return cleaned;
  };

  // Handle input change - only allow 8 digits after 010
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 숫자만 추출
    if (value.length <= 8) {
      setMobile(value);
    }
  };

  // Get full mobile number (010 + user input)
  const getFullMobile = (): string => {
    return `010${mobile}`;
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mobile || mobile.length !== 8) {
      toast.error("휴대폰 번호 8자리를 모두 입력해주세요.");
      return;
    }

    const fullMobile = getFullMobile();
    
    // Validate mobile format
    if (!validateMobile(fullMobile)) {
      toast.error("휴대폰 번호 형식이 올바르지 않습니다.");
      return;
    }

    setIsLoading(true);
    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('mobile', fullMobile)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "No rows found" error, which is expected if user doesn't exist
        console.error("Error fetching user:", fetchError);
        toast.error("로그인 중 오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }

      let userData: User;

      if (existingUser) {
        // User exists, use existing data
        userData = existingUser;
        toast.success("로그인되었습니다.");
      } else {
        // User doesn't exist, create new user
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            mobile: fullMobile,
            name: null, // name은 나중에 업데이트할 수 있도록 null로 설정
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating user:", insertError);
          toast.error("회원가입 중 오류가 발생했습니다.");
          setIsLoading(false);
          return;
        }

        userData = newUser;
        toast.success("회원가입 및 로그인되었습니다.");
      }

      // Save user to localStorage
      localStorage.setItem('buy_user_id', userData.id);
      setUser(userData);
      setMobile("");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle name registration
  const handleNameRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || name.trim().length === 0) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    if (!user) {
      toast.error("로그인 정보를 찾을 수 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ name: name.trim() })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating user name:", updateError);
        toast.error("이름 등록 중 오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }

      setUser(updatedUser);
      setName("");
      toast.success("이름이 등록되었습니다.");
    } catch (error) {
      console.error("Name registration error:", error);
      toast.error("이름 등록 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('buy_user_id');
    setUser(null);
    setMobile("");
    setName("");
    toast.success("로그아웃되었습니다.");
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">처리 중...</p>
        </div>
      </div>
    );
  }

  // Show name registration form if user is logged in but name is missing
  if (user && !user.name) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="bg-gradient-card shadow-medium">
            <CardHeader className="pb-4">
              <CardTitle className="text-center text-foreground">실명 등록</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  입금하실분의 실명을 등록해 주세요. 등록된 이름은 변경이 불가능 합니다.
                </AlertDescription>
              </Alert>
              <form onSubmit={handleNameRegistration} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    ref={nameInputRef}
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="실명을 입력하세요"
                    required
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "등록 중..." : "등록하기"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show logged in state with header
  if (user && user.name) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-medium text-foreground">{user.name}</span>
                  <span className="text-muted-foreground mx-2">•</span>
                  <span className="text-muted-foreground">{formatMobile(user.mobile)}</span>
                </div>
              </div>
              <Button 
                onClick={handleLogout} 
                variant="outline" 
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </header>
        
        {/* Empty content area */}
        <main className="container mx-auto px-4 py-8">
          {/* 빈 화면 */}
        </main>
      </div>
    );
  }

  // Show login form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-gradient-card shadow-medium">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-foreground">로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile">휴대폰 번호</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-foreground font-medium">
                    010
                  </div>
                  <div className="flex-1">
                    <Input
                      ref={inputRef}
                      id="mobile"
                      type="tel"
                      value={mobile}
                      onChange={handleMobileChange}
                      placeholder="12345678"
                      maxLength={8}
                      required
                      className="text-center"
                      autoFocus
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  휴대폰 번호 뒤 8자리를 입력하세요
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                <LogIn className="h-4 w-4 mr-2" />
                {isLoading ? "처리 중..." : "로그인"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

