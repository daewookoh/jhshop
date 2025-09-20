'use client'

import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NotFoundPage() {
  const handleGoBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back()
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">페이지를 찾을 수 없습니다</h2>
          <p className="text-muted-foreground max-w-md">
            요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
          </p>
        </div>
        
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              홈으로 돌아가기
            </Link>
          </Button>
          <Button variant="outline" onClick={handleGoBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            이전 페이지
          </Button>
        </div>
      </div>
    </div>
  )
}
