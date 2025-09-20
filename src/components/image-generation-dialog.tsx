'use client'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Image as ImageIcon } from "lucide-react";

interface ImageGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectOption: (option: 'date' | 'always') => void;
}

export function ImageGenerationDialog({ open, onOpenChange, onSelectOption }: ImageGenerationDialogProps) {
  const handleOptionSelect = (option: 'date' | 'always') => {
    onSelectOption(option);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            이미지 자동생성 옵션 선택
          </DialogTitle>
          <DialogDescription>
            어떤 상품들의 이미지를 생성하시겠습니까?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3">
            <Card 
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-muted/50"
              onClick={() => handleOptionSelect('date')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">검색일 상품</h3>
                    <p className="text-xs text-muted-foreground">
                      현재 검색된 날짜의 사용중인 상품들
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all duration-200 hover:shadow-md hover:bg-muted/50"
              onClick={() => handleOptionSelect('always')}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">상시 상품</h3>
                    <p className="text-xs text-muted-foreground">
                      상시 판매 중인 사용중인 상품들
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
