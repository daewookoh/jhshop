'use client'

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LogIn, Store } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const { user, signIn, loading } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast.error("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(loginForm.email, loginForm.password);
      
      if (error) {
        console.error("Login error:", error);
        if (error.message.includes("Invalid login credentials")) {
          toast.error("이메일 또는 비밀번호가 잘못되었습니다.");
        } else {
          toast.error("로그인에 실패했습니다. 다시 시도해주세요.");
        }
      } else {
        toast.success("로그인되었습니다.");
        return;
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("로그인 중 오류가 발생했습니다.");
    } finally {
      if (isLoading) {
        setIsLoading(false);
      }
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {isLoading ? "로그인 중..." : "로딩 중..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Store className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">과실당 Smart System</h1>
          </div>
          <p className="text-muted-foreground">관리 시스템에 로그인하세요</p>
        </div>

        <Card className="bg-gradient-card shadow-medium">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-foreground">로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">이메일</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">비밀번호</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || loading}>
                <LogIn className="h-4 w-4 mr-2" />
                {isLoading || loading ? "로그인 중..." : "로그인"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
