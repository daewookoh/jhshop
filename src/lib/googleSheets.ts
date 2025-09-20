
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
  sale_date?: string;
  price?: number;
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

// 클라이언트에서는 데이터 처리 로직을 제거하고 API 호출만 담당

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
