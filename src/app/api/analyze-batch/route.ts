import { NextRequest, NextResponse } from 'next/server';

interface OrderText {
  nickname: string;
  text: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

interface AnalyzedItem {
  productName: string;
  quantity: number;
}

interface AnalyzedOrder {
  nickname: string;
  items: AnalyzedItem[];
}

// 단일 배치 처리 함수
async function processBatch(orders: OrderText[], products: Product[]): Promise<AnalyzedOrder[]> {
  // 상품명 목록 생성
  const productNames = products
    .filter(p => p.is_active)
    .map(p => p.name)
    .join(', ');

  // GPT 프롬프트 생성
  const prompt = `
다음은 카카오톡 주문내역과 상품 목록입니다.

상품 목록: ${productNames}

주문내역:
${orders.map(order => `[${order.nickname}] ${order.text}`).join('\n')}

위 주문내역에서 상품 주문으로 인식되는 내용을 분석하여, 각 닉네임별로 상품명과 수량을 추출해주세요.

응답 형식은 다음 JSON 형태로 해주세요:
{
  "orders": [
    {
      "nickname": "닉네임",
      "items": [
        {
          "productName": "상품명",
          "quantity": 수량
        }
      ]
    }
  ]
}

주의사항:
1. 상품명은 제공된 상품 목록에서 가장 유사한 것을 선택해주세요
2. 수량이 명시되지 않은 경우 1로 설정해주세요
3. 상품 주문이 아닌 내용은 제외해주세요
4. 확실하지 않은 경우는 제외해주세요
`;

  // OpenAI API 호출
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '당신은 주문내역을 분석하는 전문가입니다. 주문내역에서 상품명과 수량을 정확하게 추출해주세요.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    console.error('OpenAI API 오류:', {
      status: openaiResponse.status,
      statusText: openaiResponse.statusText,
      error: errorText
    });
    throw new Error(`OpenAI API 호출 실패: ${openaiResponse.status} ${openaiResponse.statusText}`);
  }

  const openaiData = await openaiResponse.json();
  const content = openaiData.choices[0].message.content;

  // JSON 파싱
  let analysisResult;
  try {
    // JSON 부분만 추출 (```json으로 감싸져 있을 수 있음)
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    analysisResult = JSON.parse(jsonString);
  } catch (parseError) {
    console.error('JSON 파싱 실패:', parseError);
    console.error('GPT 응답:', content);
    throw new Error('GPT 응답 파싱 실패');
  }

  return analysisResult.orders || [];
}

export async function POST(request: NextRequest) {
  try {
    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다. 환경변수를 확인해주세요.' },
        { status: 500 }
      );
    }

    const { orders, products }: { orders: OrderText[]; products: Product[] } = await request.json();

    console.log(`단일 배치 처리: ${orders.length}개 주문`);

    const analyzedOrders = await processBatch(orders, products);

    return NextResponse.json({
      orders: analyzedOrders,
      processedCount: orders.length,
      analyzedCount: analyzedOrders.length
    });

  } catch (error) {
    console.error('배치 분석 실패:', error);
    return NextResponse.json(
      { error: '배치 분석에 실패했습니다.' },
      { status: 500 }
    );
  }
}
