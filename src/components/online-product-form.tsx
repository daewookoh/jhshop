'use client'

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { X, Plus, Save, Trash2, Edit, Check, ChevronsUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/hooks/useProducts";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type OnlineProduct = Tables<'online_products'> & {
  product: Product;
};

interface OnlineProductFormProps {
  onlineProduct?: OnlineProduct;
  products: Product[];
  onSave: (data: {
    product_id: string;
    start_datetime: string;
    end_datetime: string;
    available_quantity: number;
  }) => Promise<void>;
  onCancel: () => void;
  onDelete?: (id: number) => void;
}

export function OnlineProductForm({ onlineProduct, products, onSave, onCancel, onDelete }: OnlineProductFormProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(
    onlineProduct?.product || null
  );
  const [startDatetime, setStartDatetime] = useState(
    onlineProduct?.start_datetime 
      ? new Date(onlineProduct.start_datetime).toISOString().slice(0, 16)
      : ""
  );
  const [endDatetime, setEndDatetime] = useState(
    onlineProduct?.end_datetime 
      ? new Date(onlineProduct.end_datetime).toISOString().slice(0, 16)
      : ""
  );
  const [availableQuantity, setAvailableQuantity] = useState(
    onlineProduct?.available_quantity?.toString() || "0"
  );
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(productSearchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      toast.error("상품을 선택해주세요.");
      return;
    }
    
    if (!startDatetime) {
      toast.error("판매 시작일시를 입력해주세요.");
      return;
    }

    if (!endDatetime) {
      toast.error("판매 종료일시를 입력해주세요.");
      return;
    }

    const startDate = new Date(startDatetime);
    const endDate = new Date(endDatetime);

    if (endDate <= startDate) {
      toast.error("판매 종료일시는 판매 시작일시보다 이후여야 합니다.");
      return;
    }

    const quantity = Number(availableQuantity);
    if (isNaN(quantity) || quantity < 0) {
      toast.error("올바른 가능수량을 입력해주세요.");
      return;
    }

    try {
      await onSave({
        product_id: selectedProduct.id,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        available_quantity: quantity,
      });
    } catch (error) {
      console.error('Error saving online product:', error);
    }
  };

  const handleDelete = () => {
    if (onlineProduct?.id && onDelete) {
      onDelete(onlineProduct.id);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto bg-gradient-card shadow-medium">
      <CardHeader className="relative">
        <CardTitle className="text-xl font-bold text-foreground">
          {onlineProduct ? "온라인상품 수정" : "새 온라인상품 등록"}
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
            <Label>상품 선택</Label>
            <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productSearchOpen}
                  className="w-full justify-between"
                >
                  {selectedProduct 
                    ? selectedProduct.name 
                    : "상품을 검색하여 선택하세요..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput 
                    placeholder="상품명 검색..." 
                    value={productSearchQuery}
                    onValueChange={setProductSearchQuery}
                  />
                  <CommandList>
                    <CommandEmpty>상품을 찾을 수 없습니다.</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.id}
                          onSelect={() => {
                            setSelectedProduct(product);
                            setProductSearchOpen(false);
                            setProductSearchQuery("");
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProduct?.id === product.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex-1">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {product.price.toLocaleString()}원
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_datetime">판매 시작일시</Label>
            <Input
              id="start_datetime"
              type="datetime-local"
              value={startDatetime}
              onChange={(e) => setStartDatetime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end_datetime">판매 종료일시</Label>
            <Input
              id="end_datetime"
              type="datetime-local"
              value={endDatetime}
              onChange={(e) => setEndDatetime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="available_quantity">가능수량</Label>
            <Input
              id="available_quantity"
              type="number"
              value={availableQuantity}
              onChange={(e) => setAvailableQuantity(e.target.value)}
              placeholder="0"
              min="0"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            {onlineProduct && onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    삭제
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>온라인상품 삭제 확인</AlertDialogTitle>
                    <AlertDialogDescription>
                      정말로 이 온라인상품을 삭제하시겠습니까?
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
              {onlineProduct ? "수정" : "등록"}
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

