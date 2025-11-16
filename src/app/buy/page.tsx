import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BuyPageContent } from './BuyPageContent';
import { supabaseServer } from '@/integrations/supabase/server';

type Props = {
  searchParams: Promise<{ id?: string; keyword?: string }>;
};

// Generate metadata dynamically based on product ID or keyword
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const productId = resolvedSearchParams?.id;
  const keyword = resolvedSearchParams?.keyword;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jhshop.vercel.app';

  // If keyword is provided, search for products
  if (keyword && !productId) {
    try {
      // 먼저 products 테이블에서 키워드 검색
      const { data: matchedProducts } = await supabaseServer
        .from('products')
        .select('id, name, price, image_url')
        .ilike('name', `%${keyword}%`)
        .limit(1)
        .single();

      if (matchedProducts) {
        const product = matchedProducts;
        const productName = product?.name || keyword;
        const productPrice = product?.price || 0;
        const productImage = product?.image_url;
        const productUrl = `${baseUrl}/buy?keyword=${encodeURIComponent(keyword)}`;

        let imageUrl = productImage || '';
        if (productImage && !productImage.startsWith('http')) {
          if (productImage.startsWith('/')) {
            imageUrl = `${baseUrl}${productImage}`;
          }
        }

        return {
          title: `${productName} | 과실당`,
          description: `${productName} - ${productPrice.toLocaleString()}원 | 과실당에서 구매하세요`,
          alternates: {
            canonical: productUrl,
          },
          openGraph: {
            title: productName,
            description: `${productPrice.toLocaleString()}원`,
            type: 'website',
            url: productUrl,
            images: imageUrl ? [
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
            images: imageUrl ? [imageUrl] : [],
          },
          other: {
            'og:image:width': '1200',
            'og:image:height': '630',
            'og:image:type': 'image/jpeg',
          },
        };
      }
    } catch (error) {
      console.error('Error generating metadata for keyword:', error);
    }
  }

  // If no product ID or keyword, return default metadata
  if (!productId) {
    const ogImageUrl = `${baseUrl}/og.png`;
    return {
      title: '과실당 온라인',
      description: '엄선된 상품을 온라인에서 주문하세요',
      alternates: {
        canonical: `${baseUrl}/buy`,
      },
      openGraph: {
        title: '과실당 온라인',
        description: '엄선된 상품을 온라인에서 주문하세요',
        type: 'website',
        url: `${baseUrl}/buy`,
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: '과실당 온라인',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: '과실당 온라인',
        description: '엄선된 상품을 온라인에서 주문하세요',
        images: [ogImageUrl],
      },
      // KakaoTalk specific meta tags
      other: {
        'og:image:width': '1200',
        'og:image:height': '630',
        'og:image:type': 'image/png',
      },
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
      alternates: {
        canonical: productUrl,
      },
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
  const resolvedSearchParams = await props.searchParams;
  const productId = resolvedSearchParams?.id;
  let jsonLd = null;

  // Generate JSON-LD structured data for product
  if (productId) {
    try {
      const { data } = await supabaseServer
        .from('online_products')
        .select(`
          *,
          product:products(*)
        `)
        .eq('id', parseInt(productId))
        .single();

      if (data) {
        const product = data.product as any;
        const now = new Date();
        const start = new Date(data.start_datetime);
        const end = new Date(data.end_datetime);

        // Determine availability
        let availability = 'https://schema.org/OutOfStock';
        if (now >= start && now <= end && data.available_quantity > 0) {
          availability = 'https://schema.org/InStock';
        } else if (now < start) {
          availability = 'https://schema.org/PreOrder';
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jhshop.vercel.app';
        const productUrl = `${baseUrl}/buy?id=${productId}`;

        jsonLd = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product?.name,
          description: product?.name,
          image: product?.image_url,
          url: productUrl,
          offers: {
            '@type': 'Offer',
            url: productUrl,
            priceCurrency: 'KRW',
            price: product?.price,
            availability: availability,
            validFrom: data.start_datetime,
            validThrough: data.end_datetime,
            seller: {
              '@type': 'Organization',
              name: '과실당',
            },
          },
        };
      }
    } catch (error) {
      console.error('Error generating JSON-LD:', error);
    }
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
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
    </>
  );
}
