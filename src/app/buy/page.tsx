import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BuyPageContent } from './BuyPageContent';
import { supabaseServer } from '@/integrations/supabase/server';

type Props = {
  searchParams: Promise<{ id?: string }>;
};

// Generate metadata dynamically based on product ID
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const productId = resolvedSearchParams?.id;

  // If no product ID, return default metadata
  if (!productId) {
    return {
      title: '상품 구매 | 과실당',
      description: '과실당 상품 구매 페이지',
    };
  }

  try {
    // Fetch product data from Supabase
    const { data, error } = await supabaseServer
      .from('online_products')
      .select(`
        *,
        product:products(*)
      `)
      .eq('id', parseInt(productId))
      .single();

    if (error || !data) {
      return {
        title: '상품 구매 | 과실당',
        description: '과실당 상품 구매 페이지',
      };
    }

    const product = data.product as any;
    const rawProductName = product?.name || '상품';
    // Remove line breaks and extra whitespace from product name for Open Graph
    const productName = rawProductName.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    const productPrice = product?.price || 0;
    const productImage = product?.image_url;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jhshop.vercel.app';
    const productUrl = `${baseUrl}/buy?id=${productId}`;

    // Construct image URL - if it's a full URL, use it; otherwise make it absolute
    let imageUrl = productImage;
    if (productImage && !productImage.startsWith('http')) {
      // If image is stored in Supabase storage
      if (productImage.startsWith('/')) {
        imageUrl = `${baseUrl}${productImage}`;
      } else {
        // If it's a relative path, assume Supabase storage
        imageUrl = productImage;
      }
    }

    return {
      title: `${productName} | 과실당`,
      description: `${productName} - ${productPrice.toLocaleString()}원 | 과실당에서 구매하세요`,
      openGraph: {
        title: productName,
        description: `${productPrice.toLocaleString()}원`,
        type: 'website',
        url: productUrl,
        images: productImage ? [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: productName,
          }
        ] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: productName,
        description: `${productPrice.toLocaleString()}원`,
        images: productImage ? [imageUrl] : [],
      },
      // KakaoTalk specific meta tags
      other: {
        'og:image:width': '1200',
        'og:image:height': '630',
        'og:image:type': 'image/jpeg',
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: '상품 구매 | 과실당',
      description: '과실당 상품 구매 페이지',
    };
  }
}

export default async function BuyPage(props: Props) {
  // searchParams is already handled in generateMetadata and BuyPageContent
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    }>
      <BuyPageContent />
    </Suspense>
  );
}
