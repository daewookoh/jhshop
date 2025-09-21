'use client'

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, Users, AlertCircle } from "lucide-react";
import { toast } from "sonner";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async () => {
    if (!file) {
      toast.error("파일을 선택해주세요.");
      return;
    }

    setParsedOrders([]);
    setGroupedOrders([]);
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

        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-4 w-4" />
                주문내역 ({parsedOrders.length}건, {sortedNicknames.length}명)
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
                              <span className="whitespace-pre-line">
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
                        <div className="p-1 bg-gray-50 rounded min-h-[100px] flex items-center justify-center">
                          <div className="text-xs text-muted-foreground text-center">
                            최종주문목록이 여기에 표시됩니다
                          </div>
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
    </div>
  );
}