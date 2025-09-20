
interface OrderData {
  nickname: string;
  orderText: string;
  notes?: string;
  products?: string[];
}

interface Product {
  id: string;
  name: string;
  is_active: boolean;
}

// Next.js API 호출 헬퍼
const callNextApi = async (endpoint: string, body?: any, method: string = 'POST') => {
  const url = `/api/${endpoint}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`API 호출 실패: ${response.statusText} - ${errorData.error || errorData.message || ''}`);
  }

  return response.json();
};

// 기존 시트 목록 가져오기
export const getExistingSheets = async (): Promise<string[]> => {
  try {
    const response = await callNextApi('google-sheets', undefined, 'GET');
    return response.sheets || [];
  } catch (error) {
    console.error('시트 목록 가져오기 실패:', error);
    throw new Error('시트 목록을 가져올 수 없습니다.');
  }
};

// 새 시트 탭 생성 (실제로는 writeOrdersToSheet에서 처리됨)
export const createNewSheet = async (date: string): Promise<string> => {
  try {
    // 이 함수는 실제로는 사용되지 않음 - writeOrdersToSheet에서 시트 생성과 데이터 작성을 함께 처리
    return date;
  } catch (error) {
    console.error('새 시트 생성 실패:', error);
    throw new Error('새 시트를 생성할 수 없습니다.');
  }
};

// 상품 목록을 가나다 순으로 정렬
const sortProductsByName = (products: Product[]): Product[] => {
  return products
    .filter(p => p.is_active)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
};

// 헤더 행 생성
const createHeaderRow = (products: Product[]): string[] => {
  const sortedProducts = sortProductsByName(products);
  const productNames = sortedProducts.map(p => p.name.replace(/\n/g, ' '));
  
  return ['주문자', '원본주문', '비고', ...productNames];
};

// 주문 데이터를 스프레드시트 형식으로 변환
const formatOrderData = (orders: OrderData[], products: Product[]): string[][] => {
  const sortedProducts = sortProductsByName(products);
  const productMap = new Map(sortedProducts.map(p => [p.name, p.id]));
  
  // 닉네임별로 그룹화
  const groupedOrders = orders.reduce((acc, order) => {
    if (!acc[order.nickname]) {
      acc[order.nickname] = [];
    }
    acc[order.nickname].push(order);
    return acc;
  }, {} as Record<string, OrderData[]>);
  
  const rows: string[][] = [];
  
  Object.entries(groupedOrders).forEach(([nickname, orderList]) => {
    orderList.forEach((order, index) => {
      const row: string[] = [];
      
      // 첫 번째 행이면 닉네임 표시, 아니면 빈 문자열
      if (index === 0) {
        row.push(nickname);
      } else {
        row.push('');
      }
      
      // 원본주문
      row.push(order.orderText);
      
      // 비고
      row.push(order.notes || '');
      
      // 상품별 주문 수량 (현재는 빈 문자열로 설정, 나중에 AI 분석 결과에 따라 채울 수 있음)
      sortedProducts.forEach(() => {
        row.push('');
      });
      
      rows.push(row);
    });
  });
  
  return rows;
};

// 스프레드시트에 데이터 작성
export const writeOrdersToSheet = async (
  date: string, 
  orders: OrderData[], 
  products: Product[]
): Promise<void> => {
  try {
    const response = await callNextApi('google-sheets', {
      date,
      orders,
      products
    });
    
    console.log(`주문내역이 ${response.sheetName} 시트에 성공적으로 작성되었습니다.`);
    
  } catch (error) {
    console.error('스프레드시트 작성 실패:', error);
    throw new Error('스프레드시트에 데이터를 작성할 수 없습니다.');
  }
};
