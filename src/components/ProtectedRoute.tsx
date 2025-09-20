import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading, initialized, fallbackMode } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initialized && !loading && !user) {
      router.push('/auth');
    }
  }, [user, loading, initialized, router]);

  // 초기화되지 않았거나 로딩 중인 경우에만 로딩 표시
  if (loading || !initialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {loading ? "로딩 중..." : fallbackMode ? "Fallback 모드로 실행 중..." : "인증 상태 확인 중..."}
          </p>
        </div>
      </div>
    );
  }

  // 사용자가 없으면 로딩 표시 (리다이렉트 중)
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">로그인 페이지로 이동 중...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}