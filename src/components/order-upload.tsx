'use client'

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Users, AlertCircle, X, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useProducts } from "@/hooks/useProducts";
import { writeOrdersToSheet } from "@/lib/googleSheets";
import { supabase } from "@/integrations/supabase/client";

interface ParsedOrder {
  nickname: string;
  orderTime: string;
  orderText: string;
}

interface OrderText {
  nickname: string;
  text: string;
}

interface GroupedOrder {
  nickname: string;
  orders: ParsedOrder[];
  combinedText: string;
  latestOrderTime: string;
}

interface FinalOrderItem {
  id: string;
  nickname: string;
  productName: string;
    quantity: number;
    price: number;
    total: number;
}

interface ProductMatch {
  product: any;
    similarity: number;
}

export function OrderUpload() {
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [finalOrders, setFinalOrders] = useState<FinalOrderItem[]>([]);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectedNickname, setSelectedNickname] = useState<string>("");
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const [showProductSelection, setShowProductSelection] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchStatus, setBatchStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { products } = useProducts();
  
  // 상품 데이터 직접 로드 (전체 상품 - 사용중/미사용 모두)
  const loadAllProducts = async () => {
    try {
      console.log('상품 데이터 로드 시작...');
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('상품 로드 실패:', error);
        return;
      }

      console.log('=== 상품 로드 결과 ===');
      console.log('전체 상품 수:', data?.length || 0);
      console.log('전체 상품 목록:', data?.map(p => ({ name: p.name, is_active: p.is_active })) || []);
      
      const activeProducts = (data || []).filter(p => p.is_active === true);
      const inactiveProducts = (data || []).filter(p => p.is_active === false);
      
      console.log('활성 상품 수:', activeProducts.length);
      console.log('비활성 상품 수:', inactiveProducts.length);
      console.log('활성 상품 목록:', activeProducts.map(p => p.name));
      console.log('비활성 상품 목록:', inactiveProducts.map(p => p.name));
      
      // 전체 상품 저장 (활성/비활성 모두)
      setAllProducts(data || []);
    } catch (error) {
      console.error('상품 로드 중 오류:', error);
    }
  };

  // 컴포넌트 마운트 시 상품 로드
  React.useEffect(() => {
    loadAllProducts();
  }, []);

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

  const parseKakaoTalkFile = async (fileContent: string): Promise<ParsedOrder[]> => {
    const lines = fileContent.split('\n');
    const orders: ParsedOrder[] = [];
    const orderGroups: Record<string, { messages: { text: string; time: string }[]; firstTime: string; lastTime: string }> = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('-') || !line.startsWith('[')) {
        continue;
      }
      
      const orderPattern = /^\[([^\]]+)\]\s*\[([^\]]+)\]\s*(.*)$/;
      const match = line.match(orderPattern);
      
      if (match) {
        const [, nickname, time, orderText] = match;
        const trimmedNickname = nickname.trim();
        
        if (trimmedNickname.includes('과실당') || !orderText?.trim()) {
          continue;
        }
        
          let fullOrderText = orderText.trim();
          
        // 다음 [가 나올때까지 줄바꿈을 공백으로 치환
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j].trim();
            
          if (nextLine.startsWith('[')) break;
          if (nextLine.startsWith('-') || !nextLine) {
              j++;
              continue;
            }
            
            fullOrderText += ' ' + nextLine;
            j++;
          }
          
          i = j - 1;
          
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
      }
    }
    
    Object.entries(orderGroups).forEach(([nickname, group]) => {
      const formattedMessages = group.messages.map(msg => `[${msg.time}] ${msg.text}`);
      const combinedOrderText = formattedMessages.join('\n');
      
      orders.push({
        nickname: nickname,
        orderTime: group.firstTime,
        orderText: combinedOrderText
      });
    });
    
    return orders;
  };

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
        const combinedText = orderList.map(order => order.orderText).join('\n');
        const latestOrderTime = orderList.reduce((latest, order) => {
          return order.orderTime > latest ? order.orderTime : latest;
        }, orderList[0].orderTime);

        return {
          nickname,
          orders: orderList,
          combinedText,
          latestOrderTime
        };
      })
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
  };

  // 유사도 계산 함수 (선택한 단어가 상품명과 얼마나 일치하는지)
  const calculateSimilarity = (selectedWord: string, productName: string): number => {
    const word = selectedWord.toLowerCase().trim();
    const product = productName.toLowerCase().trim();
    
    if (word === product) return 1.0;
    if (word.length === 0 || product.length === 0) return 0.0;
    
    // 1. 정확한 매칭
    if (word === product) return 1.0;
    
    // 2. 선택한 단어가 상품명에 포함되는 경우
    if (product.includes(word)) {
      // 선택한 단어가 상품명에 완전히 포함되면 100%
      return 1.0;
    }
    
    // 3. 상품명이 선택한 단어에 포함되는 경우
    if (word.includes(product)) {
      // 포함된 상품명의 길이 비율로 계산
      return product.length / word.length;
    }
    
    // 4. 부분 매칭 (연속된 글자들)
    let maxMatch = 0;
    for (let i = 0; i <= word.length - 2; i++) {
      for (let j = i + 2; j <= word.length; j++) {
        const substring = word.substring(i, j);
        if (product.includes(substring)) {
          maxMatch = Math.max(maxMatch, substring.length);
        }
      }
    }
    
    if (maxMatch > 0) {
      return maxMatch / Math.max(word.length, product.length);
    }
    
    // 5. 글자 단위 매칭
    const wordChars = word.split('');
    const productChars = product.split('');
    const commonChars = wordChars.filter(char => productChars.includes(char));
    const charSimilarity = commonChars.length / Math.max(wordChars.length, productChars.length);
    
    // 6. 단어 단위 매칭 (공백으로 분리)
    const wordWords = word.split(/\s+/);
    const productWords = product.split(/\s+/);
    const commonWords = wordWords.filter(w => productWords.includes(w));
    const wordSimilarity = commonWords.length / Math.max(wordWords.length, productWords.length);
    
    // 가장 높은 유사도 반환
    return Math.max(charSimilarity, wordSimilarity);
  };

  // 상품 매칭 함수 (활성 상품만)
  const findProductMatches = (text: string): ProductMatch[] => {
    // 직접 로드한 전체 상품 데이터를 우선 사용
    // 없으면 useProducts 훅의 전체 상품 사용
    const allProductsToSearch = allProducts.length > 0 ? allProducts : products;
    
    // 활성 상품만 필터링
    const activeProducts = allProductsToSearch.filter(p => p.is_active === true);
    
    console.log('=== 상품 매칭 디버깅 ===');
    console.log('useProducts 상품 수:', products.length);
    console.log('직접 로드된 전체 상품 수:', allProducts.length);
    console.log('활성 상품 수:', activeProducts.length);
    console.log('활성 상품 목록:', activeProducts.map(p => p.name));
    console.log('선택된 텍스트:', text);
    
    const matches: ProductMatch[] = [];
    
    for (const product of activeProducts) {
      const dbName = product.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const similarity = calculateSimilarity(text, dbName);
      
      console.log(`상품: "${dbName}" vs 선택텍스트: "${text}" = 유사도: ${similarity.toFixed(3)}`);
      
      // 유사도가 0.1 이상이면 매칭으로 간주
      if (similarity >= 0.1) {
        matches.push({ product, similarity });
      }
    }
    
    console.log('매칭된 상품들:', matches.map(m => ({ name: m.product.name, similarity: m.similarity })));
    console.log('=== 매칭 완료 ===');
    
    // 유사도가 높은 순으로 정렬하고 최대 5개 반환
    return matches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  };

  // 텍스트 선택 핸들러
  const handleTextSelection = (text: string, nickname: string) => {
    if (text.trim().length < 2) {
      toast.error("최소 2글자 이상 선택해주세요.");
      return;
    }
    
    console.log('선택된 텍스트:', text.trim());
    console.log('활성 상품 수:', products.filter(p => p.is_active).length);
    
    setSelectedText(text.trim());
    setSelectedNickname(nickname);
    const matches = findProductMatches(text.trim());
    
    console.log('매칭된 상품 수:', matches.length);
    console.log('매칭 결과:', matches.map(m => ({ name: m.product.name, similarity: m.similarity })));
    
    setProductMatches(matches);
    setShowProductSelection(true);
  };

  // 상품 선택 핸들러 (바로 최종주문목록에 추가)
  const handleProductSelect = (product: any) => {
    const newOrder: FinalOrderItem = {
      id: `${Date.now()}-${Math.random()}`,
      nickname: selectedNickname,
      productName: product.name,
      quantity: 1,
      price: product.price,
      total: product.price * 1
    };
    
    setFinalOrders(prev => [...prev, newOrder]);
    setShowProductSelection(false);
    setSelectedText("");
    setSelectedNickname("");
    setProductMatches([]);
    
    toast.success("최종주문목록에 추가되었습니다.");
  };


  // 최종주문목록에서 삭제
  const handleRemoveFromFinalOrders = (id: string) => {
    setFinalOrders(prev => prev.filter(order => order.id !== id));
    toast.success("주문이 삭제되었습니다.");
  };

  // 수량 조정 함수
  const handleQuantityChange = (id: string, change: number) => {
    setFinalOrders(prev => prev.map(order => {
      if (order.id === id) {
        const newQuantity = Math.max(1, order.quantity + change);
        return {
          ...order,
          quantity: newQuantity,
          total: order.price * newQuantity
        };
      }
      return order;
    }));
  };

  // GPT-4o를 사용한 주문내역 분석
  const analyzeOrdersWithGPT = async () => {
    if (parsedOrders.length === 0) {
      toast.error("분석할 주문내역이 없습니다.");
      return;
    }

    // 기존 최종주문목록 초기화
    setFinalOrders([]);
    toast.info("기존 최종주문목록을 초기화하고 새로운 분석을 시작합니다.");
    
    setIsAnalyzing(true);
    setIsProcessing(true);
    setCurrentStep("GPT-4o로 주문내역 분석 중...");
    setProgress(0);

    try {
      // 원본내역에서 주문시간 내용을 제거한 텍스트 추출
      const orderTexts = parsedOrders.map(order => {
        // [시간] 패턴을 제거
        const cleanedText = order.orderText.replace(/\[[^\]]+\]\s*/g, '').trim();
        return {
          nickname: order.nickname,
          text: cleanedText
        };
      });

      console.log('=== GPT 분석용 데이터 ===');
      console.log('정리된 주문 텍스트:', orderTexts);

      // 배치 처리 정보 표시
      const totalOrders = orderTexts.length;
      const batchSize = 20;
      const totalBatches = Math.ceil(totalOrders / batchSize);
      
      console.log('배치 처리 시작:', { totalOrders, totalBatches, isAnalyzing, isProcessing });
      
      setCurrentStep(`GPT-4o가 ${totalOrders}개 주문을 ${totalBatches}개 배치로 분석 중...`);
      setBatchProgress({ current: 0, total: totalBatches });
      setBatchStatus("분석 준비 중...");
      setProgress(10);

      // 주문을 배치로 나누기
      const orderBatches: OrderText[][] = [];
      for (let i = 0; i < orderTexts.length; i += batchSize) {
        orderBatches.push(orderTexts.slice(i, i + batchSize));
      }

      let totalAnalyzedOrders = 0;
      let totalNewOrders = 0;

      // 각 배치를 순차적으로 처리
      for (let i = 0; i < orderBatches.length; i++) {
        const batch = orderBatches[i];
        
        setCurrentStep(`배치 ${i + 1}/${totalBatches} 처리 중... (${batch.length}개 주문)`);
        setBatchProgress({ current: i, total: totalBatches });
        setBatchStatus(`배치 ${i + 1} 분석 중...`);
        
        console.log(`배치 ${i + 1} 시작:`, { current: i, total: totalBatches, batchLength: batch.length });
        
        try {
          // 단일 배치 API 호출
          const response = await fetch('/api/analyze-batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orders: batch,
              products: allProducts.length > 0 ? allProducts : products
            }),
          });

          if (!response.ok) {
            throw new Error(`배치 ${i + 1} 분석 실패`);
          }

          const batchResult = await response.json();
          console.log(`배치 ${i + 1} 분석 결과:`, batchResult);
          
          totalAnalyzedOrders += batchResult.analyzedCount;

          // GPT 결과를 기존 상품과 매칭하여 최종주문목록에 추가
          const batchNewOrders: FinalOrderItem[] = [];
          
          for (const analyzedOrder of batchResult.orders) {
            const nickname = analyzedOrder.nickname;
            
            for (const item of analyzedOrder.items) {
              // 상품명과 가장 유사한 상품 찾기
              const matches = findProductMatches(item.productName);
              
              if (matches.length > 0 && matches[0].similarity >= 0.5) {
                const matchedProduct = matches[0].product;
                const newOrder: FinalOrderItem = {
                  id: `${Date.now()}-${Math.random()}`,
                  nickname: nickname,
                  productName: matchedProduct.name,
                  quantity: item.quantity,
                  price: matchedProduct.price,
                  total: matchedProduct.price * item.quantity
                };
                batchNewOrders.push(newOrder);
              }
            }
          }

          // 배치 결과를 즉시 최종주문목록에 추가
          setFinalOrders(prev => [...prev, ...batchNewOrders]);
          totalNewOrders += batchNewOrders.length;

          // 배치 완료 상태 업데이트
          setBatchProgress({ current: i + 1, total: totalBatches });
          setBatchStatus(`배치 ${i + 1} 완료: ${batchNewOrders.length}개 상품 매칭됨`);
          
          // 진행률 업데이트 (10% + 배치 진행률 * 40%)
          const batchProgressPercent = 10 + ((i + 1) / totalBatches) * 40;
          setProgress(batchProgressPercent);

          console.log(`배치 ${i + 1} 완료: ${batchNewOrders.length}개 상품이 최종주문목록에 추가됨`);

          // API 호출 간격 조절 (Rate limiting 방지)
          if (i < orderBatches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
          }

        } catch (error) {
          console.error(`배치 ${i + 1} 처리 실패:`, error);
          setBatchStatus(`배치 ${i + 1} 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
          // 개별 배치 실패 시에도 계속 진행
          continue;
        }
      }

      setProgress(100);
      setCurrentStep("GPT 분석 완료!");
      setBatchStatus("모든 배치 처리 완료!");
      
      toast.success(`GPT-4o가 ${totalBatches}개 배치로 ${totalAnalyzedOrders}개 주문을 분석하여 ${totalNewOrders}개의 상품을 자동으로 매칭했습니다!`);

    } catch (error) {
      console.error("GPT 분석 실패:", error);
      toast.error(`GPT 분석 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setCurrentStep("GPT 분석 실패");
      setBatchStatus("분석 실패");
    } finally {
      setIsAnalyzing(false);
      setIsProcessing(false);
    }
  };

  // 구글시트 작성
  const handleSaveToGoogleSheets = async () => {
    if (finalOrders.length === 0) {
      toast.error("저장할 주문이 없습니다.");
      return;
    }

    try {
      setCurrentStep("구글 스프레드시트에 등록 중...");
      setIsProcessing(true);
      setProgress(0);

      // 원본주문내역을 닉네임별로 그룹화
      const groupedByNickname = parsedOrders.reduce((acc, order) => {
        if (!acc[order.nickname]) {
          acc[order.nickname] = [];
        }
        acc[order.nickname].push(order);
        return acc;
      }, {} as Record<string, ParsedOrder[]>);

      // 최종주문목록을 닉네임별로 그룹화
      const finalOrdersByNickname = finalOrders.reduce((acc, order) => {
        if (!acc[order.nickname]) {
          acc[order.nickname] = [];
        }
        acc[order.nickname].push(order);
        return acc;
      }, {} as Record<string, FinalOrderItem[]>);

      // Google Sheets 형식으로 변환 (원본주문내역 + 최종주문 수량)
      const orderData = Object.entries(groupedByNickname).map(([nickname, orders]) => ({
        nickname,
        orderText: orders.map(order => order.orderText).join('\n'),
        notes: '',
        products: finalOrdersByNickname[nickname] ? finalOrdersByNickname[nickname].map(order => ({
          name: order.productName,
          quantity: order.quantity,
          price: order.price,
          total: order.total
        })) : []
      }));
      
      console.log('=== 구글시트 전송 데이터 ===');
      console.log('전송할 주문 데이터:', JSON.stringify(orderData, null, 2));
      console.log('전송할 상품 데이터:', allProducts.length > 0 ? allProducts : products);
      
      await writeOrdersToSheet(date, orderData, allProducts.length > 0 ? allProducts : products);
      toast.success(`구글 스프레드시트에 ${parsedOrders.length}건의 주문이 등록되었습니다!`);
      
      setProgress(100);
      setCurrentStep("구글시트 등록 완료!");
      
    } catch (error) {
      console.error("구글 스프레드시트 작성 실패:", error);
      toast.error(`구글 스프레드시트 작성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setCurrentStep("구글시트 등록 실패");
      setIsError(true);
      setError(`구글 스프레드시트 작성 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("파일을 선택해주세요.");
      return;
    }

    setParsedOrders([]);
    setGroupedOrders([]);
    setFinalOrders([]);
    setIsError(false);
    setError(null);
    
    setIsProcessing(true);
    setProgress(0);
    setCurrentStep("파일 읽는 중...");

    try {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const tryEncodings = ['EUC-KR', 'UTF-8', 'CP949'];
        let currentEncodingIndex = 0;
        
        const tryNextEncoding = () => {
          if (currentEncodingIndex >= tryEncodings.length) {
            // 모든 인코딩 시도 실패 시 원문으로 파싱 진행
            console.warn('모든 인코딩 시도 실패, 원문으로 파싱 진행');
            const reader = new FileReader();
            reader.onload = (e) => {
              const content = e.target?.result as string;
              resolve(content); // 원문 그대로 사용
            };
            reader.onerror = () => {
              reject(new Error('파일 읽기 실패'));
            };
            reader.readAsText(file, 'UTF-8'); // 기본 UTF-8로 읽기
            return;
          }
          
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            
            if (content.includes('년') && content.includes('월') && content.includes('일')) {
              resolve(content);
            } else {
              currentEncodingIndex++;
              tryNextEncoding();
            }
          };
          reader.onerror = () => {
            currentEncodingIndex++;
            tryNextEncoding();
          };
          
          reader.readAsText(file, tryEncodings[currentEncodingIndex]);
        };
        
        tryNextEncoding();
      });

      setCurrentStep("주문내역 파싱 중...");
      setProgress(50);
      
      const orders = await parseKakaoTalkFile(fileContent);
      setParsedOrders(orders);

      if (orders.length === 0) {
        toast.error("파일에서 주문내역을 찾을 수 없습니다.");
        setIsProcessing(false);
        return;
      }

      setCurrentStep("주문내역 그룹화 중...");
      setProgress(75);
      
      const grouped = groupOrdersByNickname(orders);
      setGroupedOrders(grouped);

        setProgress(100);
        setCurrentStep("완료!");
      
      toast.success(`${orders.length}건의 주문이 파싱되었습니다.`);

    } catch (error) {
      console.error("업로드 처리 실패:", error);
      setIsError(true);
      setError(`파일 처리 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      toast.error("파일 처리 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isDateValid = !date || /^\d{6}$/.test(date);
  const canUpload = file && !isProcessing;

  return (
    <div className="space-y-4 w-full overflow-x-hidden">
          {/* 업로드 설정 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" />
                주문내역 업로드
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 날짜 입력 */}
              <div className="space-y-1">
                <Label htmlFor="date" className="text-sm">주문 날짜 (선택사항)</Label>
                <Input
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                placeholder="예: 250911"
                  maxLength={6}
                  className={`h-8 ${!isDateValid && date ? "border-red-500" : ""}`}
                />
                {!isDateValid && date && (
                  <p className="text-xs text-red-500">6자리 숫자로 입력해주세요</p>
                )}
              </div>
              
              {/* 파일 업로드 */}
            <div className="space-y-1">
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
            </div>
          </div>
          
          {/* 파일 정보 표시 */}
                {file && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>{file.name}</span>
                    <Badge variant="outline" className="text-xs">{(file.size / 1024).toFixed(1)} KB</Badge>
                  </div>
                )}
            </CardContent>
          </Card>

      {/* 처리 버튼 */}
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleUpload}
          disabled={!canUpload}
              className={`${
            !canUpload 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              } min-w-[200px] px-6 py-3`}
            >
              {isProcessing 
                ? "분석 중..." 
                : file 
              ? "주문내역 분석" 
                  : "파일을 먼저 선택해주세요"
              }
            </Button>
            
            {parsedOrders.length > 0 && (
              <Button
                onClick={analyzeOrdersWithGPT}
                disabled={isAnalyzing || isProcessing}
                className={`${
                  isAnalyzing || isProcessing
                    ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                    : "bg-purple-600 hover:bg-purple-700 text-white"
                } min-w-[200px] px-6 py-3`}
              >
                {isAnalyzing ? "GPT 분석 중..." : "GPT 자동 분석"}
              </Button>
            )}
          </div>
          
          {(isProcessing || isAnalyzing) && (
            <div className="text-center text-sm text-blue-600">
              {isProcessing 
                ? "주문내역을 분석하고 있습니다. 잠시만 기다려주세요..."
                : "GPT-4o가 주문내역을 자동으로 분석하고 있습니다. 잠시만 기다려주세요..."
              }
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
                  
                  {/* 배치 진행 상황 */}
                  {isAnalyzing && batchProgress.total > 0 && (
                    <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-blue-700 font-medium">배치 처리 현황</span>
                        <span className="font-bold text-blue-800">
                          {batchProgress.current}/{batchProgress.total} 배치
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Progress 
                          value={(batchProgress.current / batchProgress.total) * 100} 
                          className="w-full h-3" 
                        />
                        <div className="text-sm text-blue-600 text-center font-medium">
                          {batchStatus}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

      {/* 주문내역 표시 */}
          {parsedOrders.length > 0 && (() => {
            const groupedByNickname = parsedOrders.reduce((acc, order) => {
              if (!acc[order.nickname]) {
                acc[order.nickname] = [];
              }
              acc[order.nickname].push(order);
              return acc;
            }, {} as Record<string, typeof parsedOrders>);
            
            const nicknameOrderCounts = Object.entries(groupedByNickname).reduce((acc, [nickname, orders]) => {
              const orderCount = orders.reduce((count, order) => {
                const timeMatches = order.orderText.match(/\[([^\]]+)\]/g);
                return count + (timeMatches ? timeMatches.length : 1);
              }, 0);
              acc[nickname] = orderCount;
              return acc;
            }, {} as Record<string, number>);

            const sortedNicknames = Object.keys(groupedByNickname).sort((a, b) => 
              a.localeCompare(b, 'ko')
            );

        // 전체 주문건수 계산 (각 닉네임별 주문건수의 합계)
        const totalOrderCount = Object.values(nicknameOrderCounts).reduce((sum, count) => sum + count, 0);

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
                        
                        <div className="flex flex-col lg:flex-row gap-4">
                          {/* 좌측: 원본 주문내역 (모바일: 위쪽, 데스크톱: 왼쪽 50%) */}
                          <div className="w-full lg:w-1/2 space-y-1">
                            <h4 className="font-medium text-xs text-muted-foreground">원본 주문내역</h4>
                        <div className="space-y-1">
                          {groupedByNickname[nickname]
                            .filter(order => {
                              const trimmedText = order.orderText.trim();
                              return trimmedText !== "" && trimmedText.length > 0 && trimmedText.replace(/\s+/g, '') !== "";
                            })
                            .map((order, index) => (
                            <div key={index} className="text-sm p-2 bg-muted rounded">
                              <span 
                                className="whitespace-pre-line select-text cursor-pointer hover:bg-blue-50 p-1 rounded"
                                onMouseUp={(e) => {
                                  const selection = window.getSelection();
                                  const selectedText = selection?.toString().trim();
                                  if (selectedText && selectedText.length >= 2) {
                                    handleTextSelection(selectedText, nickname);
                                  }
                                }}
                                onClick={(e) => {
                                  // 클릭 시에는 선택된 텍스트를 가져옴 (드래그로 선택된 경우)
                                  const selection = window.getSelection();
                                  const selectedText = selection?.toString().trim();
                                  if (selectedText && selectedText.length >= 2) {
                                    handleTextSelection(selectedText, nickname);
                                  } else {
                                    // 클릭한 위치의 단어를 선택
                                    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
                                    if (range) {
                                      const node = range.startContainer;
                                      if (node.nodeType === Node.TEXT_NODE) {
                                        const text = node.textContent || "";
                                        const offset = range.startOffset;
                                        // 단어 경계 찾기
                                        let start = offset;
                                        while (start > 0 && /\w|[가-힣]/.test(text[start - 1])) start--;
                                        let end = offset;
                                        while (end < text.length && /\w|[가-힣]/.test(text[end])) end++;
                                        const wordText = text.slice(start, end).trim();
                                        if (wordText && wordText.length >= 2) {
                                          handleTextSelection(wordText, nickname);
                                        }
                                      }
                                    }
                                  }
                                }}
                              >
                                {order.orderText}
                                      </span>
                              </div>
                          ))}
                            </div>
                          </div>
                          
                          {/* 구분선 (모바일: 가로선, 데스크톱: 세로선) */}
                          <div className="w-full h-px lg:w-px lg:h-full bg-border"></div>
                          
                      {/* 우측: 최종주문목록 영역 (모바일: 아래쪽, 데스크톱: 오른쪽 50%) */}
                          <div className="w-full lg:w-1/2 space-y-1">
                        <h4 className="font-medium text-xs text-muted-foreground">최종주문목록</h4>
                        <div className="space-y-1">
                          {finalOrders.filter(order => order.nickname === nickname).map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-2 bg-white border rounded">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{order.productName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {order.price.toLocaleString()}원
                                        </div>
                                    </div>
                              <div className="flex items-center gap-1">
                                <div className="flex flex-col">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQuantityChange(order.id, 1)}
                                    className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                  >
                                    <ChevronUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleQuantityChange(order.id, -1)}
                                    className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                  >
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <div className="text-sm font-medium min-w-[20px] text-center">
                                  {order.quantity}
                                </div>
                                <div className="text-xs text-muted-foreground min-w-[60px] text-right">
                                  {order.total.toLocaleString()}원
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveFromFinalOrders(order.id)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                                </div>
                              ))}
                          {finalOrders.filter(order => order.nickname === nickname).length === 0 && (
                            <div className="p-4 bg-gray-50 rounded min-h-[100px] flex items-center justify-center">
                              <div className="text-xs text-muted-foreground text-center">
                                원본 주문내역에서 텍스트를 드래그하여<br />상품을 선택하세요
                              </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                ))}
                </div>
              </CardContent>
            </Card>
        );
      })()}

      {/* 상품 선택 모달 */}
      {showProductSelection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">상품 선택</h3>
                <p className="text-sm text-muted-foreground">
                  선택한 텍스트: &quot;{selectedText}&quot;
                </p>
              </div>
              
              {productMatches.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">유사한 상품 (최대 5개)</Label>
                  {productMatches.map((match, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded cursor-pointer transition-colors border-gray-200 hover:border-gray-300"
                      onClick={() => handleProductSelect(match.product)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex-1 mb-1">{match.product.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {match.product.price.toLocaleString()}원
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant="outline">
                            {Math.round(match.similarity * 100)}%
                          </Badge>
                        </div>
                      </div>
                                </div>
                              ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">유사한 상품을 찾을 수 없습니다.</p>
                                </div>
                              )}
              
              <div className="flex justify-end pt-4">
              <Button
                  variant="outline"
                  onClick={() => {
                    setShowProductSelection(false);
                    setSelectedText("");
                    setSelectedNickname("");
                    setProductMatches([]);
                  }}
                >
                  닫기
              </Button>
              </div>
            </div>
          </div>
            </div>
          )}

      {/* 구글시트 작성 버튼 */}
      {parsedOrders.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleSaveToGoogleSheets}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
          >
            {isProcessing ? "구글시트 작성 중..." : `구글시트 작성 (${parsedOrders.length}건)`}
          </Button>
                  </div>
          )}
    </div>
  );
}