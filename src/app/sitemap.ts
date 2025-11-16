import { MetadataRoute } from 'next'
import { createClient } from '@/integrations/supabase/client'

export const revalidate = 3600 // 1시간마다 재생성

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient()

  // 온라인 상품 가져오기
  const { data: onlineProducts } = await supabase
    .from('online_products')
    .select(`
      id,
      updated_at,
      start_datetime,
      end_datetime,
      available_quantity,
      products (
        name
      )
    `)
    .order('created_at', { ascending: false })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'

  // 기본 페이지들
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/buy`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ]

  // 온라인 상품 페이지들
  const productPages: MetadataRoute.Sitemap = (onlineProducts || []).map((product) => {
    const now = new Date()
    const start = new Date(product.start_datetime)
    const end = new Date(product.end_datetime)

    // 상태에 따른 우선순위 설정
    let priority = 0.3 // 판매 종료
    if (now < start) {
      priority = 0.7 // 판매 예정
    } else if (now >= start && now <= end && product.available_quantity > 0) {
      priority = 0.9 // 판매중
    } else if (now >= start && now <= end && product.available_quantity === 0) {
      priority = 0.5 // 품절
    }

    return {
      url: `${baseUrl}/buy?id=${product.id}`,
      lastModified: new Date(product.updated_at),
      changeFrequency: 'daily' as const,
      priority,
    }
  })

  return [...staticPages, ...productPages]
}
