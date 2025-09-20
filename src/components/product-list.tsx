'use client'

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Search, Image as ImageIcon, ArrowUpDown, X } from "lucide-react";
import { Product } from "@/hooks/useProducts";

interface ProductListProps {
  products: Product[];
  onEditProduct: (product: Product) => void;
  onFilterChange: (filter: string) => void;
  filter: string;
  canEdit: boolean;
  canDelete: boolean;
}

type SortOption = 'date-desc' | 'name-asc';

export function ProductList({ products, onEditProduct, onFilterChange, filter, canEdit, canDelete }: ProductListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchName, setSearchName] = useState('');

  const filteredProducts = products.filter(product => {
    // 날짜 필터링
    if (filter) {
      if (filter === "상시") {
        if (product.sale_date !== "상시") return false;
      } else {
        if (product.sale_date !== filter) return false;
      }
    }
    
    // 상품명 필터링
    if (searchName) {
      if (!product.name.toLowerCase().includes(searchName.toLowerCase())) return false;
    }
    
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name, 'ko');
    } else {
      // date-desc: 등록일순 (역순) - 상시는 마지막, 날짜는 숫자 크기 역순, 같은 날짜끼리는 가나다순
      const aIsAlways = a.sale_date === "상시";
      const bIsAlways = b.sale_date === "상시";
      
      // 상시 상품은 항상 마지막에
      if (aIsAlways && !bIsAlways) return 1;
      if (!aIsAlways && bIsAlways) return -1;
      if (aIsAlways && bIsAlways) {
        // 둘 다 상시인 경우 created_at 기준
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      }
      
      // 둘 다 날짜인 경우
      const dateCompare = b.sale_date.localeCompare(a.sale_date);
      if (dateCompare !== 0) {
        // 날짜가 다르면 날짜 역순으로 정렬
        return dateCompare;
      } else {
        // 같은 날짜면 상품명 가나다순으로 정렬
        return a.name.localeCompare(b.name, 'ko');
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* 검색 및 정렬 영역 */}
        <div className="flex flex-col lg:flex-row gap-4 p-4 bg-card rounded-lg shadow-soft">
          <div className="flex-1">
            <Label htmlFor="filter">판매일 필터</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="filter"
                value={filter}
                onChange={(e) => onFilterChange(e.target.value)}
                placeholder="YYMMDD 또는 '상시' 입력"
                className="pl-10 pr-10"
              />
              {filter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilterChange("")}
                  className="absolute right-1 top-1 h-8 w-8 p-0 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex-1">
            <Label htmlFor="search-name">상품명 검색</Label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-name"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="상품명을 입력하세요"
                className="pl-10 pr-10"
              />
              {searchName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchName("")}
                  className="absolute right-1 top-1 h-8 w-8 p-0 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="min-w-0 sm:min-w-[140px]">
              <Label htmlFor="sort-select">정렬 기준</Label>
              <div className="relative mt-1">
                <ArrowUpDown className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                  <SelectTrigger className="pl-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date-desc">등록일순 (최신)</SelectItem>
                    <SelectItem value="name-asc">가나다순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center text-sm text-muted-foreground">
              <div>총 {sortedProducts.length}개 상품</div>
            </div>
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
                <th className="text-left p-4 font-medium">판매일</th>
                <th className="text-left p-4 font-medium">상태</th>
                <th className="text-center p-4 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.map((product, index) => (
                <tr key={product.id} className={`border-t hover:bg-muted/50 transition-colors ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}>
                  <td className="p-4">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-foreground whitespace-pre-line">{product.name}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-primary">{product.price.toLocaleString()}원</span>
                  </td>
                  <td className="p-4">
                    <Badge variant="outline">{product.sale_date}</Badge>
                  </td>
                  <td className="p-4">
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "사용중" : "미사용"}
                    </Badge>
                  </td>
                  <td className="p-4 text-center">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditProduct(product)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {sortedProducts.map((product) => (
          <Card key={product.id} className="bg-card shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-foreground text-sm whitespace-pre-line">{product.name}</h3>
                        <p className="font-bold text-primary text-sm">{product.price.toLocaleString()}원</p>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditProduct(product)}
                          className="h-8 w-8 p-0 flex-shrink-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">{product.sale_date}</Badge>
                    <Badge variant={product.is_active ? "default" : "secondary"} className="text-xs">
                      {product.is_active ? "사용중" : "미사용"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sortedProducts.length === 0 && (
        <div className="text-center py-12">
          <ImageIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">조건에 맞는 상품이 없습니다.</p>
        </div>
      )}
    </div>
  );
}