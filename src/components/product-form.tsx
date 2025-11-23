'use client'

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { X, Upload, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Product } from "@/hooks/useProducts";

// 오늘 날짜를 YYMMDD 형식으로 반환하는 함수
const getTodayYYMMDD = (): string => {
  const today = new Date();
  const year = today.getFullYear().toString().slice(-2); // 뒤 2자리
  const month = (today.getMonth() + 1).toString().padStart(2, '0'); // 0 패딩
  const day = today.getDate().toString().padStart(2, '0'); // 0 패딩
  return `${year}${month}${day}`;
};

interface ProductFormProps {
  product?: Product;
  onSave: (product: Omit<Product, "id" | "created_at" | "updated_at">) => void;
  onCancel: () => void;
  onDelete?: (id: string) => void;
}

export function ProductForm({ product, onSave, onCancel, onDelete }: ProductFormProps) {
  const [name, setName] = useState(product?.name || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(product?.image_url || "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [saleDateType, setSaleDateType] = useState<"date" | "always">(
    product?.sale_date === "상시" ? "always" : "date"
  );
  const [saleDate, setSaleDate] = useState(
    product?.sale_date !== "상시" ? product?.sale_date || getTodayYYMMDD() : getTodayYYMMDD()
  );

  const resizeImage = (file: File, maxSize: number): Promise<{ dataUrl: string; blob: Blob }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;

          // 이미지가 maxSize보다 큰 경우 비율을 유지하며 리사이즈
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', 0.9);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ dataUrl, blob });
              } else {
                reject(new Error('Failed to create blob'));
              }
            },
            file.type || 'image/jpeg',
            0.9
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const MAX_SIZE = 600;
        const { dataUrl, blob } = await resizeImage(file, MAX_SIZE);

        // 리사이즈된 Blob으로 새 File 생성
        const resizedFile = new File([blob], file.name, { type: file.type || 'image/jpeg' });

        setImageFile(resizedFile);
        setImagePreview(dataUrl);
      } catch (error) {
        console.error('이미지 리사이즈 실패:', error);
        toast.error('이미지 처리 중 오류가 발생했습니다.');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("상품명을 입력해주세요.");
      return;
    }
    
    if (!price || isNaN(Number(price))) {
      toast.error("올바른 가격을 입력해주세요.");
      return;
    }

    if (saleDateType === "date" && !saleDate.trim()) {
      toast.error("판매일을 입력해주세요.");
      return;
    }

    onSave({
      name: name.trim(),
      price: Number(price),
      image_url: imagePreview,
      is_active: isActive,
      sale_date: saleDateType === "always" ? "상시" : saleDate,
      imageFile
    } as any);
    
    toast.success(product ? "상품이 수정되었습니다." : "상품이 등록되었습니다.");
  };

  const handleDelete = () => {
    if (product?.id && onDelete) {
      onDelete(product.id);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-card shadow-medium">
      <CardHeader className="relative">
        <CardTitle className="text-xl font-bold text-foreground">
          {product ? "상품 수정" : "새 상품 등록"}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="absolute right-4 top-4 h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">상품명</Label>
            <Textarea
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="상품명을 입력하세요 (줄바꿈 가능)"
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">가격</Label>
            <Input
              id="price"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="가격을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <Label>상품 이미지</Label>
            <div className="space-y-4">
              {imagePreview && (
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                  <img src={imagePreview} alt="상품 이미지" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  이미지 업로드
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>판매일</Label>
            <RadioGroup
              value={saleDateType}
              onValueChange={(value) => setSaleDateType(value as "date" | "always")}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="always" id="always" />
                <Label htmlFor="always">상시</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="date" id="date" />
                <Label htmlFor="date">특정 날짜</Label>
              </div>
            </RadioGroup>
            {saleDateType === "date" && (
              <Input
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                placeholder="YYMMDD 형식 (예: 250911)"
                maxLength={6}
              />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked as boolean)}
            />
            <Label htmlFor="isActive">사용여부</Label>
          </div>

          <div className="flex gap-2 pt-4">
            {product && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>상품 삭제 확인</AlertDialogTitle>
                    <AlertDialogDescription>
                      정말로 &quot;{product.name}&quot; 상품을 삭제하시겠습니까?
                      <br />
                      이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {product ? "수정" : "등록"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              취소
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}