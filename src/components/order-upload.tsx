'use client'

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Calendar, FileText, Users, Package, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import OpenAI from 'openai';
import { writeOrdersToSheet } from "@/lib/googleSheets";

interface ParsedOrder {
  nickname: string;
  orderTime: string;
  orderText: string;
}

interface GroupedOrder {
  nickname: string;
  orders: ParsedOrder[];
  combinedText: string;
  latestOrderTime: string;
}

interface ProcessedOrder {
  nickname: string;
  orderTime: string;
  orderText: string;
  products: {
    name: string;
    quantity: number;
    price: number;
    total: number;
    similarity: number;
    originalText: string;
  }[];
  totalAmount: number;
}

export function OrderUpload() {
  // 오늘 날짜를 YYMMDD 형식으로 생성
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear().toString().slice(-2);
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  };
  
  const [date, setDate] = useState(getTodayDate());
  const [file, setFile] = useState<File | null>(null);
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [groupedOrders, setGroupedOrders] = useState<GroupedOrder[]>([]);
  const [processedOrders, setProcessedOrders] = useState<ProcessedOrder[]>([]);
  const [totalOrderCount, setTotalOrderCount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [batchResults, setBatchResults] = useState<ProcessedOrder[]>([]);
  const [totalBatches, setTotalBatches] = useState(0);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { products } = useProducts();
  
  // AI 기능 상태 확인 (코드상에서 제어)
  const isAIDisabled = false; // AI 기능을 활성화
  const hasOpenAIKey = true;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/plain") {
        toast.error("txt 파일만 업로드 가능합니다.");
        return;
      }
      setFile(selectedFile);
    }
  };

  const parseKakaoTalkFile = async (fileContent: string, targetDate: string): Promise<{ orders: ParsedOrder[]; totalOrderCount: number }> => {
    const lines = fileContent.split('\n');
    const orders: ParsedOrder[] = [];
    const orderGroups: Record<string, { messages: { text: string; time: string }[]; firstTime: string; lastTime: string }> = {};
    let totalOrderCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // - 로 시작하는 라인은 모두 삭제
      if (line.startsWith('-')) {
        continue;
      }
      
      // [ 로 시작하는 줄만 파싱
      if (!line.startsWith('[')) {
        continue;
      }
      
      // [닉네임] [시간] 패턴 찾기
      const orderPattern = /^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/;
      const match = line.match(orderPattern);
      
      if (match) {
        const [, nickname, time, orderText] = match;
        const trimmedNickname = nickname.trim();
        
        // [과실당] 으로 시작하는 줄의 내용은 패스
        if (trimmedNickname.includes('과실당')) {
          continue;
        }
        
        // 주문내용이 있는 경우만 처리
        if (orderText && orderText.trim().length > 0) {
          let fullOrderText = orderText.trim();
          
          // 다음 [가 나올때까지 줄바꿈은 " " 로 치환
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j].trim();
            
            // 다음 [가 나오면 중단
            if (nextLine.startsWith('[')) {
              break;
            }
            
            // - 로 시작하는 라인은 스킵
            if (nextLine.startsWith('-')) {
              j++;
              continue;
            }
            
            // 빈 라인은 스킵
            if (!nextLine) {
              j++;
              continue;
            }
            
            // 줄바꿈을 공백으로 치환
            fullOrderText += ' ' + nextLine;
            j++;
          }
          
          // 인덱스를 다음 주문으로 이동
          i = j - 1;
          
          // 닉네임별로 그룹화
          if (!orderGroups[trimmedNickname]) {
            orderGroups[trimmedNickname] = {
              messages: [],
              firstTime: time.trim(),
              lastTime: time.trim()
            };
          }
          
          orderGroups[trimmedNickname].messages.push({
            text: fullOrderText,
            time: time.trim()
          });
          orderGroups[trimmedNickname].lastTime = time.trim();
          
          totalOrderCount++;
        }
      }
    }
    
    // 그룹화된 주문들을 결과 형식으로 변환
    Object.entries(orderGroups).forEach(([nickname, group]) => {
      // 각 메시지를 [시간] 내용 형식으로 변환
      const formattedMessages = group.messages.map(msg => {
        return `[${msg.time}] ${msg.text}`;
      });
      
      const combinedOrderText = formattedMessages.join('\n');
      
      orders.push({
        nickname: nickname,
        orderTime: group.firstTime,
        orderText: combinedOrderText
      });
    });
    
    return { orders, totalOrderCount };
  };

  // 주문을 닉네임별로 그룹화하는 함수
  const groupOrdersByNickname = (orders: ParsedOrder[]): GroupedOrder[] => {
    const grouped = orders.reduce((acc, order) => {
      if (!acc[order.nickname]) {
        acc[order.nickname] = [];
      }
      acc[order.nickname].push(order);
      return acc;
    }, {} as Record<string, ParsedOrder[]>);

    return Object.entries(grouped)
      .map(([nickname, orderList]) => {
        // txt 파일에서 파싱한 순서대로 유지 (정렬하지 않음)
        const sortedOrderList = orderList;
        
        // 모든 주문 텍스트를 합치기 (이미 파싱에서 올바른 형식으로 처리됨)
        const combinedText = sortedOrderList.map(order => {
          return order.orderText;
        }).join('\n');
        
        // 가장 최근 주문 시간 찾기
        const latestOrderTime = sortedOrderList.reduce((latest, order) => {
          return order.orderTime > latest ? order.orderTime : latest;
        }, sortedOrderList[0].orderTime);

        return {
          nickname,
          orders: sortedOrderList,
          combinedText,
          latestOrderTime
        };
      })
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko')); // 닉네임 가나다 순 정렬
  };


  // 배치 크기 설정 (프롬프트 길이 제한)
  const MAX_PROMPT_LENGTH = 15000; // 약 15KB
  const BATCH_SIZE = 20; // 한 번에 처리할 주문 그룹 수

  // 통일된 AI 프롬프트 템플릿
  const getAIPrompt = (productList: string, ordersText: string, isBatch: boolean = false) => {
    const batchWarning = isBatch ? "\n⚠️ 중요: 위 주문 목록에 있는 모든 닉네임의 주문을 반드시 분석해야 합니다. 누락이 있어서는 안됩니다!\n" : "";
    
    return `당신은 카카오톡 주문 메시지 분석 전문가입니다.

=== 상품 목록 ===
${productList}

=== 주문 목록 (같은 닉네임은 하나로 합쳐짐) ===
${ordersText}

=== 분석 규칙 ===
1. 같은 닉네임의 모든 주문을 하나의 주문내역으로 처리
2. 각 주문에서 상품명과 수량을 정확히 추출
3. 상품명 매칭 규칙:
   - 정확히 일치하지 않더라도 유사한 상품을 찾아 매핑하세요
   - "방할머니 파김치" → "방할머니 파김치 1팩(1키로)" 매칭 가능
   - "편육" → "흙돼지편육2팩" 매칭 가능
   - 상품명의 핵심 키워드를 기준으로 매칭하세요
   - 상품 목록에서 가장 유사한 상품을 찾아 매핑하세요
   - 상품명은 반드시 위 상품 목록에 있는 정확한 이름을 사용 (예: "곱창전골도 1팩 추가할게용" → "곱창전골")
4. 수량 추출 규칙 (매우 중요 - 반드시 정확히 계산하세요):
   
   **편육 관련 특별 규칙:**
   - "편육 2팩" → quantity: 1 (흙돼지편육2팩 상품 1개 주문)
   - "편육 4팩" → quantity: 2 (흙돼지편육2팩 상품 2개 주문)
   - "편육 6팩" → quantity: 3 (흙돼지편육2팩 상품 3개 주문)
   - "편육 8팩" → quantity: 4 (흙돼지편육2팩 상품 4개 주문)
   - 계산 공식: 주문팩수 ÷ 상품팩수 = 주문수량 (예: 4팩 ÷ 2팩 = 2개)
   
   **일반 상품 규칙:**
   - "방할머니 파김치 2키로" → quantity: 2 (1키로 상품을 2개 주문)
   - "사과 3개" → quantity: 3
   - "닭발 1팩" → quantity: 1
   - "A2팩" → quantity: 1 (상품명에 숫자가 포함되어 있어도 주문 수량은 1개)
   - "B3팩 2개" → quantity: 2 (명시된 수량이 있으면 그 수량 사용)
   
   **핵심 원칙:**
   - 상품명에 포함된 수량과 주문 수량을 명확히 구분하세요
   - 주문에서 요청한 총 수량을 상품의 단위로 나누어 계산하세요
   - 숫자 + 단위(팩, 개, 키로, kg 등) 패턴을 정확히 인식하세요
   - 상품명 자체에 숫자가 포함된 경우와 주문 수량을 구분하세요
5. 가격은 반드시 상품 목록에서 해당 상품의 정확한 가격을 사용 (절대 0원이면 안됨)
6. 유사도는 0.0~1.0으로 평가 (1.0=완전일치)
7. 매핑 불가능한 주문도 최대한 상품을 찾아서 매핑하세요. 빈 products 배열은 최후의 수단입니다.
8. originalText는 각 상품별로 해당 상품과 관련된 원본 텍스트 부분을 저장 (줄바꿈 제거)
9. 모든 원본 주문 텍스트는 절대 누락되어서는 안 됨
10. 가격이 0원인 경우는 절대 허용되지 않음 - 반드시 상품 목록에서 정확한 가격을 찾아서 사용
11. 예외 처리: 만약 목록에 없는 상품을 주문하거나, 수량이 불분명하면 'error' 필드에 이유를 적어줘${batchWarning}

=== 수량 추출 예시 ===
- "편육 2팩" → quantity: 1 (흙돼지편육2팩 상품 1개)
- "편육 4팩" → quantity: 2 (흙돼지편육2팩 상품 2개)
- "사과 3개" → quantity: 3  
- "닭발 1팩" → quantity: 1
- "곱창전골도 1팩 추가할게용" → quantity: 1
- "무뼈닭발 2팩" → quantity: 2

=== 응답 형식 ===
반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트나 설명은 포함하지 마세요.

{
  "orders": [
    {
      "nickname": "닉네임",
      "orderTime": "가장 최근 주문시간",
      "orderText": "원본 주문 텍스트 전체",
      "products": [
        {
          "name": "상품명",
          "quantity": 수량,
          "price": 가격,
          "total": 총가격,
          "similarity": 유사도,
          "originalText": "모든 원본텍스트 합친 것 (줄바꿈 제거)"
        }
      ]
    }
  ]
}`;
  };

  const processOrdersWithAI = async (orders: ParsedOrder[]): Promise<ProcessedOrder[]> => {
    
    // AI 기능 활성화 (코드상에서 제어)
    const isAIDisabled = false; // AI 기능을 활성화
    if (isAIDisabled) {
      return orders.map(order => ({
        id: `manual_${Date.now()}_${Math.random()}`,
        nickname: order.nickname,
        orderTime: order.orderTime,
        orderText: order.orderText,
        products: [],
        totalAmount: 0,
        status: 'pending' as const,
        notes: 'AI 분석 일시 비활성화 - 수동 확인 필요'
      }));
    }
    

    const openai = new OpenAI({
      apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
      dangerouslyAllowBrowser: true
    });

    const activeProducts = products.filter(p => p.is_active);
    
    if (activeProducts.length === 0) {
      throw new Error('활성 상품이 없습니다. 상품을 먼저 등록해주세요.');
    }
    
    setCurrentStep("AI로 전체 주문내역 분석 중...");

    try {
      
      // 미리 그룹화된 주문 사용
      const groupedOrders = groupOrdersByNickname(orders);

      const productList = activeProducts.map(p => `${p.name}(${p.price}원)`).join(', ');
      
      // 배치 처리 여부 결정
      const needsBatchProcessing = groupedOrders.length > BATCH_SIZE;
      
      if (needsBatchProcessing) {
        return await processOrdersInBatches(openai, groupedOrders, productList, activeProducts);
      } else {
        return await processOrdersSingleBatch(openai, groupedOrders, productList, activeProducts);
      }
    } catch (error: any) {
      console.error('AI 분석 실패:', error);
      console.error('에러 타입:', typeof error);
      console.error('에러 메시지:', error.message);
      console.error('에러 스택:', error.stack);
      
      // 에러 메시지 표시
      toast.error(`AI 분석 실패: ${error.message || '알 수 없는 오류가 발생했습니다.'}`);
      throw error; // 에러를 다시 던져서 상위에서 처리하도록 함
    }
  };

  // 단일 배치 처리
  const processOrdersSingleBatch = async (
    openai: OpenAI, 
    groupedOrders: GroupedOrder[], 
    productList: string, 
    activeProducts: any[]
  ): Promise<ProcessedOrder[]> => {
    
    // 단일 배치도 배치 카운터 설정
    setTotalBatches(1);
    setCompletedBatches(0);
    
    // AI 요청용 텍스트 생성
    const ordersText = groupedOrders.map((group, index) => 
      `${index + 1}. [${group.nickname}] ${group.combinedText}`
    ).join('\n');
    

    const prompt = getAIPrompt(productList, ordersText, false);

    const result = await callOpenAIHybrid(openai, prompt, groupedOrders.length, groupedOrders, activeProducts);
    
    // expert 검증 완료 후에만 결과를 화면에 표시
    setBatchResults(result);
    setCompletedBatches(1);
    
    // 단일 배치 완료 시 진행률 90%로 설정
    setProgress(90);
    
    return result;
  };

  // 배치 처리 함수
  const processOrdersInBatches = async (
    openai: OpenAI, 
    groupedOrders: GroupedOrder[], 
    productList: string, 
    activeProducts: any[]
  ): Promise<ProcessedOrder[]> => {
    
    const allProcessedOrders: ProcessedOrder[] = [];
    const totalBatches = Math.ceil(groupedOrders.length / BATCH_SIZE);
    setTotalBatches(totalBatches);
    setCompletedBatches(0);
    
    for (let i = 0; i < groupedOrders.length; i += BATCH_SIZE) {
      const batch = groupedOrders.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      setCurrentStep(`AI 분석 중... (${batchNumber}/${totalBatches} 배치)`);
      
      // 배치 시작 시 진행률 업데이트 (전체 100% 기준으로 계산)
      const progressPercent = ((batchNumber - 1) / totalBatches) * 100;
      setProgress(progressPercent);
      
      // AI 요청용 텍스트 생성
      const ordersText = batch.map((group, index) => 
        `${index + 1}. [${group.nickname}] ${group.combinedText}`
      ).join('\n');

      const prompt = getAIPrompt(productList, ordersText, true);

      try {
        const batchResult = await callOpenAIHybrid(openai, prompt, batch.length, groupedOrders, activeProducts);
        allProcessedOrders.push(...batchResult);
        
        // expert 검증 완료 후에만 결과를 화면에 표시
        setBatchResults(prev => [...prev, ...batchResult]);
        setCompletedBatches(batchNumber);
        
        // 배치 완료 후 진행률 업데이트 (전체 100% 기준으로 계산)
        const progressPercent = (batchNumber / totalBatches) * 100;
        setProgress(progressPercent);
        
        // 배치 간 잠시 대기 (API 제한 방지)
        if (batchNumber < totalBatches) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`배치 ${batchNumber} 처리 실패:`, error);
        throw new Error(`배치 ${batchNumber} 처리 중 오류가 발생했습니다: ${error}`);
      }
    }
    
    // 중복 제거 및 닉네임 순 정렬
    const uniqueOrders = allProcessedOrders.reduce((acc, order) => {
      const existingIndex = acc.findIndex(o => o.nickname === order.nickname);
      if (existingIndex >= 0) {
        // 같은 닉네임이 있으면 상품을 합치기
        acc[existingIndex].products.push(...order.products);
        acc[existingIndex].totalAmount += order.totalAmount;
      } else {
        acc.push(order);
      }
      return acc;
    }, [] as ProcessedOrder[]);
    
    // 닉네임 가나다 순으로 정렬
    const sortedOrders = uniqueOrders.sort((a, b) => 
      a.nickname.localeCompare(b.nickname, 'ko')
    );
    
    return sortedOrders;
  };

  // 강력한 JSON 파싱 함수
  const parseAIResponse = (text: string): any => {
    
    // 1단계: 마크다운 코드 블록 제거
    const cleanedText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/^```$/gm, '')
      .trim();
    
    // 2단계: JSON 부분 추출
    const jsonMatches = [
      cleanedText.match(/\{[\s\S]*\}/), // 전체 JSON 객체
      cleanedText.match(/\{[\s\S]*"orders"[\s\S]*\}/), // orders가 포함된 JSON
    ].filter(Boolean);
    
    for (const match of jsonMatches) {
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.orders && Array.isArray(parsed.orders)) {
            return parsed;
          }
        } catch (e) {
          console.log('JSON 파싱 시도 실패:', e instanceof Error ? e.message : String(e));
        }
      }
    }
    
    // 3단계: 수동으로 JSON 수정 시도
    try {
      // 불완전한 JSON을 수정
      let fixedJson = cleanedText;
      
      // 마지막에 불완전한 배열이나 객체가 있으면 제거
      fixedJson = fixedJson.replace(/,\s*$/, ''); // 마지막 쉼표 제거
      fixedJson = fixedJson.replace(/,\s*\]/, ']'); // 배열 내 마지막 쉼표 제거
      fixedJson = fixedJson.replace(/,\s*\}/, '}'); // 객체 내 마지막 쉼표 제거
      
      // 불완전한 문자열 제거
      fixedJson = fixedJson.replace(/"[^"]*$/, ''); // 마지막 불완전한 문자열 제거
      
      // 닫히지 않은 배열이나 객체 닫기
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      const openBrackets = (fixedJson.match(/\[/g) || []).length;
      const closeBrackets = (fixedJson.match(/\]/g) || []).length;
      
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedJson += '}';
      }
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixedJson += ']';
      }
      
      
      const parsed = JSON.parse(fixedJson);
      if (parsed.orders && Array.isArray(parsed.orders)) {
        return parsed;
      }
    } catch (e) {
      console.log('수정된 JSON 파싱도 실패:', e instanceof Error ? e.message : String(e));
    }
    
    // 4단계: 부분 파싱ㄷㅅ 시도 (orders 배열만 추출)
    try {
      const ordersMatch = cleanedText.match(/"orders"\s*:\s*\[([\s\S]*?)\]/);
      if (ordersMatch) {
        const ordersText = '[' + ordersMatch[1] + ']';
        const orders = JSON.parse(ordersText);
        return { orders };
      }
    } catch (e) {
      console.log('부분 파싱도 실패:', e instanceof Error ? e.message : String(e));
    }
    
    throw new Error(`JSON 파싱 실패. 원본 응답: ${text.substring(0, 1000)}...`);
  };

  // 1단계: gpt-4o-mini로 1차 처리 (Triage/분류)
  const callOpenAIMini = async (openai: OpenAI, prompt: string, orderCount: number, groupedOrders: GroupedOrder[], activeProducts: any[]): Promise<ProcessedOrder[]> => {
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 8000
    });
    

    const text = completion.choices[0]?.message?.content || '';
    
    
    try {
      const parsed = parseAIResponse(text);
      
      const processedOrders: ProcessedOrder[] = parsed.orders.map((orderData: any) => {
        const totalAmount = orderData.products.reduce((sum: number, p: any) => sum + p.total, 0);
        
        // 그룹화된 주문에서 원본 텍스트 찾기
        const groupedOrder = groupedOrders.find(g => 
          g.nickname === orderData.nickname || 
          g.nickname.includes(orderData.nickname) || 
          orderData.nickname.includes(g.nickname)
        );
        const orderText = groupedOrder?.combinedText || orderData.orderText || '';
        
        // 원본 텍스트가 누락된 경우 그룹화된 주문에서 복원 및 가격 검증
        const productsWithOriginalText = orderData.products.map((product: any) => {
          // AI가 반환한 상품명을 DB의 정확한 상품명으로 매핑
          const cleanedName = product.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          const matchedProduct = activeProducts.find(p => {
            const dbName = p.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            return dbName === cleanedName || 
                   dbName.includes(cleanedName) || 
                   cleanedName.includes(dbName) ||
                   p.name === cleanedName;
          });
          
          if (matchedProduct) {
            // DB의 정확한 상품명 사용 (줄바꿈만 제거)
            product.name = matchedProduct.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            product.price = matchedProduct.price;
            product.total = product.quantity * matchedProduct.price;
          } else {
            // 더 유연한 매핑 시도
            const flexibleMatch = activeProducts.find(p => {
              const dbName = p.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
              const searchName = cleanedName.toLowerCase();
              return dbName.includes(searchName) || 
                     searchName.includes(dbName) ||
                     dbName.split(' ').some((word: string) => searchName.includes(word)) ||
                     searchName.split(' ').some((word: string) => dbName.includes(word));
            });
            
            if (flexibleMatch) {
              product.name = flexibleMatch.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
              product.price = flexibleMatch.price;
              product.total = product.quantity * flexibleMatch.price;
            } else {
              console.warn(`상품명 매핑 실패 - ${orderData.nickname}: "${cleanedName}"`);
              product.name = cleanedName;
            }
          }
          
          if (!product.originalText || product.originalText.trim() === '') {
            // 그룹화된 주문에서 원본 텍스트 찾기 (닉네임 매칭 개선)
            const groupedOrder = groupedOrders.find(g => 
              g.nickname === orderData.nickname || 
              g.nickname.includes(orderData.nickname) || 
              orderData.nickname.includes(g.nickname)
            );
            if (groupedOrder) {
              console.warn(`원본 텍스트 누락 복원 - ${orderData.nickname}:`, product.name);
              product.originalText = groupedOrder.combinedText;
            } else {
              console.error(`원본 텍스트를 찾을 수 없음 - ${orderData.nickname}:`, product.name);
              product.originalText = '원본 주문내역을 찾을 수 없습니다';
            }
          }
          
          return product;
        });
        
        return {
          nickname: orderData.nickname,
          orderTime: orderData.orderTime,
          orderText: orderText, // 그룹화된 주문에서 가져온 원본 텍스트 사용
          products: productsWithOriginalText,
          totalAmount
        };
      });

      // 닉네임 가나다 순으로 정렬
      const sortedProcessedOrders = processedOrders.sort((a, b) => 
        a.nickname.localeCompare(b.nickname, 'ko')
      );
      
      return sortedProcessedOrders;
    } catch (error) {
      console.error('gpt-4o-mini 응답 파싱 실패:', error);
      throw error;
    }
  };

  // 2단계: gpt-4o로 2차 처리 (Expert Review/전문가 검토)
  const callOpenAI4o = async (openai: OpenAI, prompt: string, orderCount: number, groupedOrders: GroupedOrder[], activeProducts: any[]): Promise<ProcessedOrder[]> => {
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 8000
    });
    

    const text = completion.choices[0]?.message?.content || '';
    
    
    try {
      const parsed = parseAIResponse(text);
      
      const processedOrders: ProcessedOrder[] = parsed.orders.map((orderData: any) => {
        const totalAmount = orderData.products.reduce((sum: number, p: any) => sum + p.total, 0);
        
        // 그룹화된 주문에서 원본 텍스트 찾기
        const groupedOrder = groupedOrders.find(g => 
          g.nickname === orderData.nickname || 
          g.nickname.includes(orderData.nickname) || 
          orderData.nickname.includes(g.nickname)
        );
        const orderText = groupedOrder?.combinedText || orderData.orderText || '';
        
        // 원본 텍스트가 누락된 경우 그룹화된 주문에서 복원 및 가격 검증
        const productsWithOriginalText = orderData.products.map((product: any) => {
          // AI가 반환한 상품명을 DB의 정확한 상품명으로 매핑
          const cleanedName = product.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
          const matchedProduct = activeProducts.find(p => {
            const dbName = p.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            return dbName === cleanedName || 
                   dbName.includes(cleanedName) || 
                   cleanedName.includes(dbName) ||
                   p.name === cleanedName;
          });
          
          if (matchedProduct) {
            // DB의 정확한 상품명 사용 (줄바꿈만 제거)
            product.name = matchedProduct.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
            product.price = matchedProduct.price;
            product.total = product.quantity * matchedProduct.price;
          } else {
            // 더 유연한 매핑 시도
            const flexibleMatch = activeProducts.find(p => {
              const dbName = p.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
              const searchName = cleanedName.toLowerCase();
              return dbName.includes(searchName) || 
                     searchName.includes(dbName) ||
                     dbName.split(' ').some((word: string) => searchName.includes(word)) ||
                     searchName.split(' ').some((word: string) => dbName.includes(word));
            });
            
            if (flexibleMatch) {
              product.name = flexibleMatch.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
              product.price = flexibleMatch.price;
              product.total = product.quantity * flexibleMatch.price;
            } else {
              console.warn(`상품명 매핑 실패 - ${orderData.nickname}: "${cleanedName}"`);
              product.name = cleanedName;
            }
          }
          
          if (!product.originalText || product.originalText.trim() === '') {
            // 그룹화된 주문에서 원본 텍스트 찾기 (닉네임 매칭 개선)
            const groupedOrder = groupedOrders.find(g => 
              g.nickname === orderData.nickname || 
              g.nickname.includes(orderData.nickname) || 
              orderData.nickname.includes(g.nickname)
            );
            if (groupedOrder) {
              console.warn(`원본 텍스트 누락 복원 - ${orderData.nickname}:`, product.name);
              product.originalText = groupedOrder.combinedText;
            } else {
              console.error(`원본 텍스트를 찾을 수 없음 - ${orderData.nickname}:`, product.name);
              product.originalText = '원본 주문내역을 찾을 수 없습니다';
            }
          }
          
          return product;
        });
        
        return {
          nickname: orderData.nickname,
          orderTime: orderData.orderTime,
          orderText: orderText, // 그룹화된 주문에서 가져온 원본 텍스트 사용
          products: productsWithOriginalText,
          totalAmount
        };
      });

      // 닉네임 가나다 순으로 정렬
      const sortedProcessedOrders = processedOrders.sort((a, b) => 
        a.nickname.localeCompare(b.nickname, 'ko')
      );
      
      return sortedProcessedOrders;
    } catch (error) {
      console.error('gpt-4o 응답 파싱 실패:', error);
      throw error;
    }
  };

  
  // AI 처리 전략: 옵션에 따라 1차 과정 생략 또는 하이브리드 모드 실행
  const callOpenAIHybrid = async (openai: OpenAI, prompt: string, orderCount: number, groupedOrders: GroupedOrder[], activeProducts: any[]): Promise<ProcessedOrder[]> => {
    try {
      const expertResult = await callOpenAI4o(openai, prompt, orderCount, groupedOrders, activeProducts);
      console.log('gpt-4o 전문가 처리 완료');
      return expertResult;
    } catch (error) {
      console.error('gpt-4o 처리 실패:', error);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("파일을 선택해주세요.");
      return;
    }

    // 분석 시작 전 하단 내용 리셋
    setParsedOrders([]);
    setGroupedOrders([]);
    setProcessedOrders([]);
    setBatchResults([]);
    setTotalBatches(0);
    setCompletedBatches(0);
    setIsError(false);
    setError(null);
    
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep("기존 데이터 삭제 중...");

    // orders 테이블을 사용하지 않으므로 기존 데이터 삭제 과정 생략

    setCurrentStep("파일 읽는 중...");

    try {
      // 파일 읽기 (인코딩 처리) - 여러 인코딩 시도
      const fileContent = await new Promise<string>((resolve, reject) => {
        const tryEncodings = ['EUC-KR', 'UTF-8', 'CP949'];
        let currentEncodingIndex = 0;
        
        const tryNextEncoding = () => {
          if (currentEncodingIndex >= tryEncodings.length) {
            reject(new Error('모든 인코딩 시도 실패'));
            return;
          }
          
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            console.log(`인코딩 ${tryEncodings[currentEncodingIndex]} 시도:`, content.substring(0, 200));
            
            // 한글이 제대로 표시되는지 확인
            if (content.includes('년') && content.includes('월') && content.includes('일')) {
              console.log('올바른 인코딩 발견:', tryEncodings[currentEncodingIndex]);
              resolve(content);
            } else {
              console.log('인코딩 실패, 다음 시도:', tryEncodings[currentEncodingIndex]);
              currentEncodingIndex++;
              tryNextEncoding();
            }
          };
          reader.onerror = () => {
            console.log('인코딩 오류, 다음 시도:', tryEncodings[currentEncodingIndex]);
            currentEncodingIndex++;
            tryNextEncoding();
          };
          
          reader.readAsText(file, tryEncodings[currentEncodingIndex]);
        };
        
        tryNextEncoding();
      });

      setCurrentStep("주문내역 파싱 중...");
      const { orders, totalOrderCount } = await parseKakaoTalkFile(fileContent, date || '');
      setParsedOrders(orders);
      setTotalOrderCount(totalOrderCount); // 실제 주문 건수 저장

      if (orders.length === 0) {
        toast.error("파일에서 주문내역을 찾을 수 없습니다.");
        setIsProcessing(false);
        return;
      }

      // 주문을 닉네임별로 그룹화
      setCurrentStep("주문내역 그룹화 중...");
      const grouped = groupOrdersByNickname(orders);
      setGroupedOrders(grouped);
      console.log('그룹화 완료:', grouped.length, '개 닉네임');

      setCurrentStep("AI로 주문내역 분석 중...");
      
      // AI 분석 기능 활성화
      try {
        const processed = await processOrdersWithAI(orders);
        console.log('AI 분석 결과:', processed);
        console.log('분석된 주문 개수:', processed.length);
        setProcessedOrders(processed);

        setProgress(100);
        setCurrentStep("완료!");
        toast.success(`${processed.length}건의 주문이 AI로 분석되었습니다.`);
      } catch (aiError) {
        // AI 분석 실패 시 처리
        console.error("AI 분석 실패:", aiError);
        setCurrentStep("AI 분석 실패");
        setProgress(0);
        setIsError(true);
        setError(`AI 분석 실패: ${aiError instanceof Error ? aiError.message : '알 수 없는 오류'}`);
        // 에러 메시지는 processOrdersWithAI에서 이미 표시됨
      }

    } catch (error) {
      console.error("업로드 처리 실패:", error);
      setIsError(true);
      setError(`파일 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      toast.error("파일 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };


  const handleSaveToDatabase = async () => {
    console.log('저장할 주문내역:', processedOrders);
    console.log('주문내역 개수:', processedOrders.length);
    
    if (processedOrders.length === 0) {
      toast.error("저장할 주문내역이 없습니다.");
      return;
    }

    // 주문내역이 있는 닉네임만 필터링
    const ordersWithProducts = processedOrders.filter(order => order.products.length > 0);
    
    if (ordersWithProducts.length === 0) {
      toast.error("저장할 주문내역이 없습니다. (모든 주문에서 상품을 찾을 수 없음)");
      return;
    }

    console.log('상품이 있는 주문 수:', ordersWithProducts.length);
    console.log('스킵된 주문 수:', processedOrders.length - ordersWithProducts.length);

    // orders 테이블을 사용하지 않으므로 데이터베이스 저장 과정 생략
    toast.success(`${ordersWithProducts.length}건의 주문이 분석되었습니다. (데이터베이스 저장 생략)`);
    
    // 상태 초기화 (파일은 유지)
    setDate("");
    // setFile(null); // 파일을 유지하여 버튼이 계속 보이도록 함
    setParsedOrders([]);
    setGroupedOrders([]);
    setProcessedOrders([]);
    setBatchResults([]);
    setTotalBatches(0);
    setCompletedBatches(0);
  };

  const handleSaveToGoogleSheets = async () => {
    if (processedOrders.length === 0) {
      toast.error("저장할 주문내역이 없습니다.");
      return;
    }

    // AI 분석에서 상품이 있는 주문만 필터링
    const ordersWithProducts = processedOrders.filter(order => order.products.length > 0);
    
    if (ordersWithProducts.length === 0) {
      toast.error("AI 분석에서 상품을 찾을 수 없는 주문만 있습니다. 스프레드시트에 등록할 데이터가 없습니다.");
      return;
    }

    try {
      setCurrentStep("구글 스프레드시트에 등록 중...");
      setIsProcessing(true);
      setProgress(0);

      // AI 분석에서 상품이 있는 주문만 Google Sheets 형식으로 변환
      const orderData = ordersWithProducts.map(order => ({
        nickname: order.nickname,
        orderText: order.orderText
          .replace(/\r\n/g, '\n')  // Windows 줄바꿈을 Unix 줄바꿈으로 통일
          .replace(/\r/g, '\n')    // Mac 줄바꿈을 Unix 줄바꿈으로 통일
          .replace(/\n/g, '\n'),   // 명시적으로 줄바꿈 문자 보장
        notes: '',
        products: order.products.map(product => ({
          name: product.name,
          quantity: product.quantity,
          price: product.price,
          total: product.total
        }))
      }));
      
      console.log('구글시트 등록 데이터:', orderData);
      console.log('각 주문의 orderText 확인:', orderData.map(o => ({ nickname: o.nickname, orderText: o.orderText, products: o.products })));
      
      // Google Sheets에 작성 (AI 분석된 수량 포함)
      await writeOrdersToSheet(date, orderData, products);
      toast.success(`구글 스프레드시트에 AI 분석 결과가 성공적으로 등록되었습니다! (${ordersWithProducts.length}명의 주문)`);
      
      setProgress(100);
      setCurrentStep("구글시트 등록 완료!");
      
    } catch (spreadsheetError) {
      console.error("구글 스프레드시트 작성 실패:", spreadsheetError);
      toast.error(`구글 스프레드시트 작성 실패: ${spreadsheetError instanceof Error ? spreadsheetError.message : '알 수 없는 오류'}`);
      setCurrentStep("구글시트 등록 실패");
      setIsError(true);
      setError(`구글 스프레드시트 작성 실패: ${spreadsheetError instanceof Error ? spreadsheetError.message : '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(false);
    }
  };


  const isDateValid = !date || /^\d{6}$/.test(date); // 날짜가 없거나 유효한 경우
  const canUpload = file && !isProcessing;
  const isButtonDisabled = !file || isProcessing;

  return (
    <div className="space-y-4 w-full overflow-x-hidden">
          {/* AI 상태 표시 */}
          {isAIDisabled && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                AI 기능이 일시적으로 비활성화되어 있습니다. 주문내역은 기본 파싱만 수행되며, 상품 매핑은 수동으로 확인해야 합니다.
                <br />
                <span className="text-xs text-muted-foreground">
                  AI 기능을 다시 활성화하려면 코드에서 isAIDisabled를 false로 변경하세요.
                </span>
              </AlertDescription>
            </Alert>
          )}
          

          {/* 업로드 설정 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                주문내역 업로드
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 날짜 입력 */}
              <div className="space-y-1">
                <Label htmlFor="date" className="text-sm">주문 날짜 (선택사항)</Label>
                <Input
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="예: 250911 (비워두면 전체 분석)"
                  maxLength={6}
                  className={`h-8 ${!isDateValid && date ? "border-red-500" : ""}`}
                />
                {!isDateValid && date && (
                  <p className="text-xs text-red-500">6자리 숫자로 입력해주세요</p>
                )}
              </div>
              
              {/* 파일 업로드 */}
              <div className="space-y-2">
                <Label className="text-sm">카카오톡 파일</Label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt"
                    onChange={handleFileSelect}
                    className="flex-1 h-8"
                  />
                  {file && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                    >
                      제거
                    </Button>
                  )}
                </div>
                {file && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>{file.name}</span>
                    <Badge variant="outline" className="text-xs">{(file.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 처리 버튼 - 항상 표시 */}
          <div className="flex justify-center">
            <Button
              onClick={handleUpload}
              disabled={isButtonDisabled}
              className={`${
                isButtonDisabled 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              } min-w-[300px] px-6 py-3`}
              style={{ 
                display: 'block',
                visibility: 'visible',
                opacity: isButtonDisabled ? 0.6 : 1,
                backgroundColor: isButtonDisabled ? '#9CA3AF' : '#2563EB',
                color: 'white',
                border: 'none',
                minWidth: '300px',
                whiteSpace: 'nowrap'
              }}
            >
              {isProcessing 
                ? "분석 중..." 
                : file 
                  ? "주문내역 AI 분석" 
                  : "파일을 먼저 선택해주세요"
              }
            </Button>
          </div>
          
          {isProcessing && (
            <div className="text-center text-sm text-blue-600">
              주문내역을 분석하고 있습니다. 잠시만 기다려주세요...
            </div>
          )}

          {/* 에러 상태 표시 */}
          {isError && error && (
            <Card>
              <CardContent className="pt-6">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="font-medium">처리 중 오류가 발생했습니다</div>
                      <div className="text-sm">{error}</div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setIsError(false);
                          setError(null);
                        }}
                        className="mt-2"
                      >
                        닫기
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {/* 처리 진행상황 */}
          {isProcessing && !isError && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">{currentStep}</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}



          {/* 주문내역 (닉네임별 그룹핑, 가나다 순) */}
          {parsedOrders.length > 0 && (() => {
            // 닉네임별로 그룹핑 (실제 주문시간 기준으로 카운트)
            const groupedByNickname = parsedOrders.reduce((acc, order) => {
              if (!acc[order.nickname]) {
                acc[order.nickname] = [];
              }
              acc[order.nickname].push(order);
              return acc;
            }, {} as Record<string, typeof parsedOrders>);
            
            // 각 닉네임별 실제 주문 건수 계산 (주문시간 기준)
            const nicknameOrderCounts = Object.entries(groupedByNickname).reduce((acc, [nickname, orders]) => {
              // 각 주문의 orderText에서 실제 주문시간 개수 계산
              const orderCount = orders.reduce((count, order) => {
                // orderText에서 [시간] 패턴의 개수를 세어서 실제 주문 건수 계산
                const timeMatches = order.orderText.match(/\[([^\]]+)\]/g);
                return count + (timeMatches ? timeMatches.length : 1);
              }, 0);
              acc[nickname] = orderCount;
              return acc;
            }, {} as Record<string, number>);

            // 닉네임을 가나다 순으로 정렬
            const sortedNicknames = Object.keys(groupedByNickname).sort((a, b) => 
              a.localeCompare(b, 'ko')
            );

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    주문내역 ({totalOrderCount}건, {sortedNicknames.length}명)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sortedNicknames.map((nickname) => (
                      <div key={nickname} className="space-y-2">
                        <div className="font-medium text-sm text-primary border-b pb-1">
                          {nickname} ({nicknameOrderCounts[nickname]}건)
                        </div>
                        <div className="space-y-1 ml-2">
                          {groupedByNickname[nickname].map((order, index) => {
                            // orderText는 이미 [시간] 내용 형식으로 파싱됨
                            return (
                              <div key={index} className="text-sm p-2 bg-muted rounded">
                                <span className="whitespace-pre-line">
                                  {order.orderText}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}


          {/* 배치별 실시간 결과 */}
          {batchResults.length > 0 && isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  실시간 분석 결과 ({batchResults.length}건)
                  {totalBatches > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {completedBatches}/{totalBatches} 배치 완료
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {batchResults.map((order, index) => {
                    // 그룹화된 주문에서 원본 텍스트 가져오기 (닉네임 매칭 개선)
                    const groupedOrder = groupedOrders.find(g => 
                      g.nickname === order.nickname || 
                      g.nickname.includes(order.nickname) || 
                      order.nickname.includes(g.nickname)
                    );
                    const combinedOriginalText = groupedOrder?.combinedText || '원본 주문내역을 찾을 수 없습니다';
                    
                    return (
                      <div key={index} className="border rounded-lg p-3 bg-green-50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="whitespace-nowrap">
                              {order.nickname} ({order.orderText.split('\n').length}건)
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {order.orderTime.includes('-') ? 
                                (() => {
                                  const parts = order.orderTime.split(' ');
                                  if (parts.length >= 2) {
                                    return parts.slice(1).join(' ');
                                  }
                                  return order.orderTime;
                                })() : 
                                order.orderTime
                              }
                            </span>
                          </div>
                          <Badge className="bg-green-600">
                            {order.totalAmount.toLocaleString()}원
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-4">
                          {/* 좌측: 원본 주문내역 (모바일: 위쪽, 데스크톱: 왼쪽 50%) */}
                          <div className="w-full lg:w-1/2 space-y-1">
                            <h4 className="font-medium text-xs text-muted-foreground">원본 주문내역</h4>
                            <div className="p-1 bg-white rounded">
                              <div className="text-[12px] font-mono  break-words">
                                {combinedOriginalText.split(/(?=\[오[전후]\s+\d+:\d+\])/).map((part, index) => {
                                  // [18일 오후 12:51] 패턴으로 줄바꿈 처리
                                  if (part.trim()) {
                                    const trimmedPart = part.trim();
                                    // 시간 패턴만 있고 내용이 없는 라인 제거
                                    const timeOnlyPattern = /^\[오[전후]\s+\d+:\d+\]\s*$/;
                                    if (timeOnlyPattern.test(trimmedPart)) {
                                      return null;
                                    }
                                    return (
                                      <span key={index}>
                                        {index > 0 && '\n'}
                                        {trimmedPart}
                                      </span>
                                    );
                                  }
                                  return null;
                                }).filter(Boolean)}
                              </div>
                            </div>
                          </div>
                          
                          {/* 구분선 (모바일: 가로선, 데스크톱: 세로선) */}
                          <div className="w-full h-px lg:w-px lg:h-full bg-border"></div>
                          
                          {/* 우측: 분석된 주문내역 (모바일: 아래쪽, 데스크톱: 오른쪽 50%) */}
                          <div className="w-full lg:w-1/2 space-y-1">
                            <h4 className="font-medium text-xs text-muted-foreground">분석된 주문내역</h4>
                            <div className="space-y-1">
                              {order.products.map((product, pIndex) => (
                                <div key={pIndex} className="flex items-center justify-between text-xs p-1 bg-white rounded">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium">{product.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}</div>
                                      <div className="text-xs text-muted-foreground">({product.price.toLocaleString()}원)</div>
                                    </div>
                                    <Badge 
                                      variant={product.similarity >= 0.8 ? "default" : product.similarity >= 0.6 ? "secondary" : "destructive"}
                                      className="text-xs flex-shrink-0"
                                    >
                                      {Math.round(product.similarity * 100)}%
                                    </Badge>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <div className="text-xs text-muted-foreground">
                                      {product.quantity}개
                                    </div>
                                    <div className="font-medium">
                                      {product.total.toLocaleString()}원
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {order.products.length === 0 && (
                                <div className="text-xs text-muted-foreground p-1 bg-white rounded text-center">
                                  분석된 상품이 없습니다
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 처리된 주문내역 - AI 기능이 활성화되었을 때만 표시 */}
          {!isAIDisabled && processedOrders.length > 0 && !isProcessing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  분석된 주문내역 ({processedOrders.length}건)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {processedOrders.map((order, index) => {
                    // 그룹화된 주문에서 원본 텍스트 가져오기 (닉네임 매칭 개선)
                    const groupedOrder = groupedOrders.find(g => 
                      g.nickname === order.nickname || 
                      g.nickname.includes(order.nickname) || 
                      order.nickname.includes(g.nickname)
                    );
                    const combinedOriginalText = groupedOrder?.combinedText || '원본 주문내역을 찾을 수 없습니다';
                    
                    return (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="whitespace-nowrap">
                              {order.nickname} ({order.orderText.split('\n').length}건)
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {order.orderTime.includes('-') ? 
                                (() => {
                                  const parts = order.orderTime.split(' ');
                                  if (parts.length >= 2) {
                                    const day = parts[0].split('-')[2];
                                    return `${day}일 ${parts.slice(1).join(' ')}`;
                                  }
                                  return order.orderTime;
                                })() : 
                                order.orderTime
                              }
                            </span>
                          </div>
                          <Badge className="bg-gradient-accent">
                            {order.totalAmount.toLocaleString()}원
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-4">
                          {/* 좌측: 원본 주문내역 (모바일: 위쪽, 데스크톱: 왼쪽 50%) */}
                          <div className="w-full lg:w-1/2 space-y-2">
                            <h4 className="font-medium text-sm text-muted-foreground">원본 주문내역</h4>
                            <div className="p-2 bg-muted rounded">
                              <div className="text-[12px] font-mono  break-words">
                                {combinedOriginalText.split(/(?=\[오[전후]\s+\d+:\d+\])/).map((part, index) => {
                                  // [18일 오후 12:51] 패턴으로 줄바꿈 처리
                                  if (part.trim()) {
                                    const trimmedPart = part.trim();
                                    // 시간 패턴만 있고 내용이 없는 라인 제거
                                    const timeOnlyPattern = /^\[오[전후]\s+\d+:\d+\]\s*$/;
                                    if (timeOnlyPattern.test(trimmedPart)) {
                                      return null;
                                    }
                                    return (
                                      <span key={index}>
                                        {index > 0 && '\n'}
                                        {trimmedPart}
                                      </span>
                                    );
                                  }
                                  return null;
                                }).filter(Boolean)}
                              </div>
                            </div>
                          </div>
                          
                          {/* 구분선 (모바일: 가로선, 데스크톱: 세로선) */}
                          <div className="w-full h-px lg:w-px lg:h-full bg-border"></div>
                          
                          {/* 우측: 분석된 주문내역 (모바일: 아래쪽, 데스크톱: 오른쪽 50%) */}
                          <div className="w-full lg:w-1/2 space-y-2">
                            <h4 className="font-medium text-sm text-muted-foreground">분석된 주문내역</h4>
                            <div className="space-y-1">
                              {order.products.map((product, pIndex) => (
                                <div key={pIndex} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium">{product.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}</div>
                                      <div className="text-xs text-muted-foreground">({product.price.toLocaleString()}원)</div>
                                    </div>
                                    <Badge 
                                      variant={product.similarity >= 0.8 ? "default" : product.similarity >= 0.6 ? "secondary" : "destructive"}
                                      className="text-xs flex-shrink-0"
                                    >
                                      {Math.round(product.similarity * 100)}%
                                    </Badge>
                                  </div>
                                  <div className="text-right flex-shrink-0 ml-2">
                                    <div className="text-xs text-muted-foreground">
                                      {product.quantity}개
                                    </div>
                                    <div className="font-medium">
                                      {product.total.toLocaleString()}원
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {order.products.length === 0 && (
                                <div className="text-sm text-muted-foreground p-2 bg-muted rounded text-center">
                                  분석된 상품이 없습니다
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 액션 버튼들 - AI 기능이 활성화되었을 때만 표시 */}
          {!isAIDisabled && processedOrders.length > 0 && !isProcessing && (
            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleSaveToGoogleSheets}
                className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                구글시트 등록
              </Button>
              <Button
                onClick={handleSaveToDatabase}
                className="bg-gradient-accent hover:bg-gradient-accent/90 flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                데이터베이스 저장
              </Button>
            </div>
          )}

          {/* 구글시트 등록 진행상황 - 구글시트 등록 중일 때만 표시 */}
          {!isAIDisabled && processedOrders.length > 0 && isProcessing && currentStep.includes("구글") && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="text-sm">{currentStep}</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}
    </div>
  );
}
