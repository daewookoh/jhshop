'use client'

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Image as ImageIcon, Search, X } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Product } from "@/hooks/useProducts";

type OnlineProduct = Tables<'online_products'> & {
  product: Product;
};

interface OnlineProductListProps {
  onlineProducts: OnlineProduct[];
  onEditProduct: (onlineProduct: OnlineProduct) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export function OnlineProductList({ onlineProducts, onEditProduct, canEdit, canDelete }: OnlineProductListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = onlineProducts.filter(op => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      op.product.name.toLowerCase().includes(query) ||
      op.product.price.toString().includes(query)
    );
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const dateA = new Date(a.start_datetime).getTime();
    const dateB = new Date(b.start_datetime).getTime();
    return dateB - dateA; // 최신순
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatus = (onlineProduct: OnlineProduct) => {
    const now = new Date();
    const start = new Date(onlineProduct.start_datetime);
    const end = new Date(onlineProduct.end_datetime);

    if (now < start) return { label: "판매예정", variant: "secondary" as const };
    if (now >= start && now <= end) {
      if (onlineProduct.available_quantity > 0) {
        return { label: "판매중", variant: "default" as const };
      } else {
        return { label: "품절", variant: "destructive" as const };
      }
    }
    return { label: "판매종료", variant: "outline" as const };
  };

  const handleCopyLink = async (onlineProductId: number) => {
    const url = `${window.location.origin}/buy?id=${onlineProductId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("판매링크가 복사되었습니다.");
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error("링크 복사에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 p-4 bg-card rounded-lg shadow-soft">
          <div className="flex-1">
            <Label htmlFor="search">검색</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상품명 또는 가격으로 검색..."
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1 h-8 w-8 p-0 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-end text-sm text-muted-foreground">
            <div>총 {sortedProducts.length}개 상품</div>
          </div>
        </div>
      </div>

      {/* Desktop view */}
      <div className="hidden md:block bg-card rounded-lg shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-4 font-medium">이미지</th>
                <th className="text-left p-4 font-medium">상품명</th>
                <th className="text-left p-4 font-medium">가격</th>
                <th className="text-left p-4 font-medium">판매 기간</th>
                <th className="text-left p-4 font-medium">가능수량</th>
                <th className="text-left p-4 font-medium">상태</th>
                <th className="text-center p-4 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((onlineProduct, index) => {
                const status = getStatus(onlineProduct);
                return (
                  <tr key={onlineProduct.id} className={`border-t hover:bg-muted/50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                    <td className="p-4">
                      <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                        {onlineProduct.product.image_url ? (
                          <img
                            src={onlineProduct.product.image_url}
                            alt={onlineProduct.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium text-foreground whitespace-pre-line">
                        {onlineProduct.product.name}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-primary">
                        {onlineProduct.product.price.toLocaleString()}원
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">
                          <span className="text-muted-foreground">시작:</span> {formatDateTime(onlineProduct.start_datetime)}
                        </span>
                        <span className="text-sm">
                          <span className="text-muted-foreground">종료:</span> {formatDateTime(onlineProduct.end_datetime)}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-medium">{onlineProduct.available_quantity}</span>
                    </td>
                    <td className="p-4">
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(onlineProduct.id)}
                        >
                          링크복사
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditProduct(onlineProduct)}
                            className="h-16 w-16 p-0"
                            title="수정"
                          >
                            <Edit className="h-16 w-16" strokeWidth={2.5} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {sortedProducts.map((onlineProduct) => {
          const status = getStatus(onlineProduct);
          return (
            <Card key={onlineProduct.id} className="bg-card shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {onlineProduct.product.image_url ? (
                      <img
                        src={onlineProduct.product.image_url}
                        alt={onlineProduct.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground text-sm whitespace-pre-line">
                          {onlineProduct.product.name}
                        </h3>
                        <p className="font-bold text-primary text-sm">
                          {onlineProduct.product.price.toLocaleString()}원
                        </p>
                        <div className="text-xs text-muted-foreground mt-1">
                          <div>시작: {formatDateTime(onlineProduct.start_datetime)}</div>
                          <div>종료: {formatDateTime(onlineProduct.end_datetime)}</div>
                          <div>수량: {onlineProduct.available_quantity}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(onlineProduct.id)}
                          className="text-xs"
                        >
                          링크복사
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditProduct(onlineProduct)}
                            className="h-16 w-16 p-0 flex-shrink-0"
                            title="수정"
                          >
                            <Edit className="h-16 w-16" strokeWidth={2.5} />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <Badge variant={status.variant} className="text-xs">
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sortedProducts.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            {searchQuery ? "검색 결과가 없습니다." : "등록된 온라인상품이 없습니다."}
          </p>
        </div>
      )}
    </div>
  );
}

