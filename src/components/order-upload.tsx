'use client'

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Users, AlertCircle, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useProducts } from "@/hooks/useProducts";
import { writeOrdersToSheet } from "@/lib/googleSheets";
import { supabase } from "@/integrations/supabase/client";

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
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [allProducts, setAllProducts] = useState<any[]>([]);
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

  // 유사도 계산 함수 (0.0 ~ 1.0 범위로 제한)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;
    
    // 1. 정확한 매칭
    if (s1 === s2) return 1.0;
    
    // 2. 포함 관계 매칭 (수정: 1.0을 초과하지 않도록)
    if (s1.includes(s2) || s2.includes(s1)) {
      const minLength = Math.min(s1.length, s2.length);
      const maxLength = Math.max(s1.length, s2.length);
      // 포함된 부분의 비율로 계산 (최대 0.9)
      return Math.min(minLength / maxLength * 0.9, 0.9);
    }
    
    // 3. 순차적 글자 매칭
    let matchingChars = 0;
    const maxLength = Math.max(s1.length, s2.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < s1.length && i < s2.length && s1[i] === s2[i]) {
        matchingChars++;
      }
    }
    
    const sequentialSimilarity = matchingChars / maxLength;
    
    // 4. 공통 글자 매칭 (순서 무관)
    const chars1 = s1.split('');
    const chars2 = s2.split('');
    const commonChars = chars1.filter(char => chars2.includes(char));
    const commonSimilarity = commonChars.length / Math.max(chars1.length, chars2.length);
    
    // 5. 키워드 매칭
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    const keywordSimilarity = commonWords.length / Math.max(words1.length, words2.length);
    
    // 가장 높은 유사도 반환 (0.0 ~ 1.0 범위로 제한)
    return Math.min(Math.max(sequentialSimilarity, commonSimilarity, keywordSimilarity), 1.0);
  };

  // 상품 매칭 함수 (전체 상품 - 활성/비활성 모두)
  const findProductMatches = (text: string): ProductMatch[] => {
    // 직접 로드한 전체 상품 데이터를 우선 사용
    // 없으면 useProducts 훅의 전체 상품 사용
    const allProductsToSearch = allProducts.length > 0 ? allProducts : products;
    
    console.log('=== 상품 매칭 디버깅 ===');
    console.log('useProducts 상품 수:', products.length);
    console.log('직접 로드된 전체 상품 수:', allProducts.length);
    console.log('최종 검색할 상품 수:', allProductsToSearch.length);
    console.log('최종 검색할 상품 목록:', allProductsToSearch.map(p => ({ name: p.name, is_active: p.is_active })));
    console.log('선택된 텍스트:', text);
    
    const matches: ProductMatch[] = [];
    
    for (const product of allProductsToSearch) {
      const dbName = product.name.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const similarity = calculateSimilarity(text, dbName);
      
      console.log(`상품: "${dbName}" (활성: ${product.is_active}) vs 선택텍스트: "${text}" = 유사도: ${similarity.toFixed(3)}`);
      
      // 유사도가 0.1 이상이면 매칭으로 간주 (활성/비활성 모두 포함)
      if (similarity >= 0.1) {
        matches.push({ product, similarity });
      }
    }
    
    console.log('매칭된 상품들:', matches.map(m => ({ name: m.product.name, is_active: m.product.is_active, similarity: m.similarity })));
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

  // 상품 선택 핸들러
  const handleProductSelect = (product: any) => {
    // 미사용 상품인 경우 경고창 표시
    if (!product.is_active) {
      alert("미사용 상품입니다.");
      return;
    }
    
    setSelectedProduct(product);
    setQuantity(1);
  };

  // 최종주문목록에 추가
  const handleAddToFinalOrders = () => {
    if (!selectedProduct) {
      toast.error("상품을 선택해주세요.");
      return;
    }
    
    if (quantity <= 0) {
      toast.error("수량을 1개 이상 입력해주세요.");
      return;
    }
    
    const newOrder: FinalOrderItem = {
      id: `${Date.now()}-${Math.random()}`,
      nickname: selectedNickname,
      productName: selectedProduct.name,
      quantity: quantity,
      price: selectedProduct.price,
      total: selectedProduct.price * quantity
    };
    
    setFinalOrders(prev => [...prev, newOrder]);
    setShowProductSelection(false);
    setSelectedProduct(null);
    setSelectedText("");
    setSelectedNickname("");
    setProductMatches([]);
    setQuantity(1);
    
    toast.success("최종주문목록에 추가되었습니다.");
  };

  // 최종주문목록에서 삭제
  const handleRemoveFromFinalOrders = (id: string) => {
    setFinalOrders(prev => prev.filter(order => order.id !== id));
    toast.success("주문이 삭제되었습니다.");
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

      // 닉네임별로 그룹화
      const groupedByNickname = finalOrders.reduce((acc, order) => {
        if (!acc[order.nickname]) {
          acc[order.nickname] = [];
        }
        acc[order.nickname].push(order);
        return acc;
      }, {} as Record<string, FinalOrderItem[]>);

      // Google Sheets 형식으로 변환
      const orderData = Object.entries(groupedByNickname).map(([nickname, orders]) => ({
        nickname,
        orderText: orders.map(order => `${order.productName} ${order.quantity}개`).join('\n'),
        notes: '',
        products: orders.map(order => ({
          name: order.productName,
          quantity: order.quantity,
          price: order.price,
          total: order.total
        }))
      }));
      
      console.log('=== 구글시트 전송 데이터 ===');
      console.log('전송할 주문 데이터:', JSON.stringify(orderData, null, 2));
      console.log('전송할 상품 데이터:', allProducts.length > 0 ? allProducts : products);
      
      await writeOrdersToSheet(date, orderData, allProducts.length > 0 ? allProducts : products);
      toast.success(`구글 스프레드시트에 ${finalOrders.length}건의 주문이 등록되었습니다!`);
      
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
            reject(new Error('모든 인코딩 시도 실패'));
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
          <div className="flex justify-center">
            <Button
              onClick={handleUpload}
          disabled={!canUpload}
              className={`${
            !canUpload 
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              } min-w-[300px] px-6 py-3`}
            >
              {isProcessing 
                ? "분석 중..." 
                : file 
              ? "주문내역 분석" 
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
                          {groupedByNickname[nickname].map((order, index) => (
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
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          {finalOrders.filter(order => order.nickname === nickname).map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-2 bg-white border rounded">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{order.productName}</div>
                                <div className="text-xs text-muted-foreground">
                                  {order.quantity}개 × {order.price.toLocaleString()}원 = {order.total.toLocaleString()}원
                                        </div>
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
                      className={`p-3 border rounded cursor-pointer transition-colors ${
                        selectedProduct?.id === match.product.id
                          ? 'border-blue-500 bg-blue-50'
                          : match.product.is_active
                            ? 'border-gray-200 hover:border-gray-300'
                            : 'border-red-200 bg-red-50 hover:border-red-300'
                      }`}
                      onClick={() => handleProductSelect(match.product)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2 mb-1">
                            <div className="font-medium truncate flex-1">{match.product.name}</div>
                            {!match.product.is_active && (
                              <Badge variant="destructive" className="text-xs flex-shrink-0">
                                미사용
                              </Badge>
                            )}
                          </div>
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
              
              {selectedProduct && (
                <div className="space-y-2">
                  <Label htmlFor="quantity" className="text-sm font-medium">수량</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="h-8"
                  />
                            </div>
              )}
              
              <div className="flex gap-2 pt-4">
              <Button
                  variant="outline"
                  onClick={() => {
                    setShowProductSelection(false);
                    setSelectedProduct(null);
                    setSelectedText("");
                    setSelectedNickname("");
                    setProductMatches([]);
                    setQuantity(1);
                  }}
                  className="flex-1"
                >
                  취소
              </Button>
              <Button
                  onClick={handleAddToFinalOrders}
                  disabled={!selectedProduct}
                  className="flex-1"
              >
                  추가
              </Button>
              </div>
            </div>
          </div>
            </div>
          )}

      {/* 구글시트 작성 버튼 */}
      {finalOrders.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleSaveToGoogleSheets}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
          >
            {isProcessing ? "구글시트 작성 중..." : `구글시트 작성 (${finalOrders.length}건)`}
          </Button>
                  </div>
          )}
    </div>
  );
}