'use client'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FloatingButton } from "@/components/ui/floating-button";
import { ProductForm } from "@/components/product-form";
import { ProductList } from "@/components/product-list";
import { OnlineProductForm } from "@/components/online-product-form";
import { OnlineProductList } from "@/components/online-product-list";
import { OnlineOrderList } from "@/components/online-order-list";
import { ImageGenerationDialog } from "@/components/image-generation-dialog";
import { OrderUpload } from "@/components/order-upload";
import { Plus, Upload, Download, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { useProducts, Product } from "@/hooks/useProducts";
import { useOnlineProducts, OnlineProduct } from "@/hooks/useOnlineProducts";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, profile, signOut, isManagerOrAdmin, isAdmin, loading, initialized, fallbackMode } = useAuth();
  const { products, loading: productsLoading, addProduct, updateProduct, deleteProduct, uploadImage } = useProducts();
  const { onlineProducts, loading: onlineProductsLoading, addOnlineProduct, updateOnlineProduct, deleteOnlineProduct } = useOnlineProducts();
  const [activeTab, setActiveTab] = useState(() => {
    // localStorage에서 마지막 활성 탭 복원 (SSR 안전)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeTab') || "products";
    }
    return "products";
  });
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [showOnlineProductForm, setShowOnlineProductForm] = useState(false);
  const [editingOnlineProduct, setEditingOnlineProduct] = useState<OnlineProduct | undefined>();
  const [productFilter, setProductFilter] = useState("");
  const [showImageGenerationDialog, setShowImageGenerationDialog] = useState(false);

  const handleSaveProduct = async (productData: any) => {
    try {
      let imageUrl = productData.image_url;
      
      // Upload image if there's a new file
      if (productData.imageFile) {
        const uploadedUrl = await uploadImage(productData.imageFile);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const finalProductData = {
        name: productData.name,
        price: productData.price,
        image_url: imageUrl,
        is_active: productData.is_active,
        sale_date: productData.sale_date
      };

      if (editingProduct) {
        const success = await updateProduct(editingProduct.id, finalProductData);
        if (success) {
          setShowProductForm(false);
          setEditingProduct(undefined);
        }
      } else {
        const success = await addProduct(finalProductData);
        if (success) {
          setShowProductForm(false);
          setEditingProduct(undefined);
        }
      }
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    const success = await deleteProduct(productId);
    if (success) {
      setShowProductForm(false);
      setEditingProduct(undefined);
    }
  };

  const handleEditOnlineProduct = (onlineProduct: OnlineProduct) => {
    setEditingOnlineProduct(onlineProduct);
    setShowOnlineProductForm(true);
  };

  const handleDeleteOnlineProduct = async (onlineProductId: number) => {
    const success = await deleteOnlineProduct(onlineProductId);
    if (success) {
      setShowOnlineProductForm(false);
      setEditingOnlineProduct(undefined);
    }
  };

  const handleSaveOnlineProduct = async (data: {
    product_id: string;
    start_datetime: string;
    end_datetime: string;
    available_quantity: number;
  }) => {
    if (editingOnlineProduct) {
      const success = await updateOnlineProduct(editingOnlineProduct.id, data);
      if (success) {
        setShowOnlineProductForm(false);
        setEditingOnlineProduct(undefined);
      }
    } else {
      const success = await addOnlineProduct(data);
      if (success) {
        setShowOnlineProductForm(false);
        setEditingOnlineProduct(undefined);
      }
    }
  };

  const handleImageGenerateClick = () => {
    setShowImageGenerationDialog(true);
  };

  const handleImageGenerate = async (option: 'date' | 'always') => {
    // 옵션에 따라 필터링된 상품 중 사용여부가 체크된 상품들
    const targetProducts = products.filter(product => {
      if (!product.is_active) return false;
      
      if (option === 'date') {
        // 검색일 상품: 현재 필터된 날짜의 상품들
        return productFilter && product.sale_date === productFilter;
      } else {
        // 상시 상품: 상시 판매 상품들
        return product.sale_date === "상시";
      }
    });

    if (targetProducts.length === 0) {
      const message = option === 'date' 
        ? "검색된 날짜의 사용중인 상품이 없습니다." 
        : "상시 판매 중인 사용중인 상품이 없습니다.";
      toast.error(message);
      return;
    }

    const optionText = option === 'date' ? '검색일' : '상시';
    toast.info(`${optionText} 상품 ${targetProducts.length}개의 이미지 편집을 시작합니다.`);
    
    try {
      const { editProductImage, createZipAndDownload } = await import("@/lib/imageEditor");
      const editedFiles: { blob: Blob; filename: string }[] = [];

      for (const product of targetProducts) {
        try {
          const editedBlob = await editProductImage({ product });
          const filename = `${product.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}_${product.price}.webp`;
          editedFiles.push({ blob: editedBlob, filename });
          
          toast.success(`${product.name} 이미지 편집 완료`);
        } catch (error) {
          console.error(`Error editing image for ${product.name}:`, error);
          toast.error(`${product.name} 이미지 편집 실패`);
        }
      }

      if (editedFiles.length > 0) {
        await createZipAndDownload(editedFiles);
        toast.success(`${editedFiles.length}개 이미지 다운로드 완료`);
      }
    } catch (error) {
      console.error('Error in image generation:', error);
      toast.error("이미지 생성 중 오류가 발생했습니다.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("로그아웃되었습니다.");
      // 페이지 새로고침 없이 상태 변경으로 처리
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error("로그아웃에 실패했습니다.");
    }
  };

  // activeTab 변경 시 localStorage에 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab]);

  // Redirect to login page if user is not authenticated
  useEffect(() => {
    if (initialized && !user) {
      router.push('/auth');
    }
  }, [initialized, user, router]);

  if ((!profile || loading) && initialized && user) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header with logout button even during loading */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-primary text-primary-foreground rounded-lg shadow-strong">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <span className="text-sm">
              {loading ? "인증 상태 확인 중..." : fallbackMode ? "Fallback 모드로 실행 중..." : "프로필 정보 로딩 중..."}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <LogOut className="h-4 w-4 mr-2" />
            로그아웃
          </Button>
        </div>
        
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {loading ? "인증 상태를 확인하고 있습니다..." : fallbackMode ? "Fallback 모드로 실행 중입니다..." : "프로필 정보를 불러오는 중..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (initialized && !user) {
    return null;
  }

  // Show access denied for regular users (hidden)
  if (!isManagerOrAdmin) {
    return (
      <div className="min-h-screen bg-background">
        {/* Empty screen for users without proper permissions */}
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto p-4 max-w-6xl">
          {/* Header with user info and logout */}
          <div className="flex items-center justify-between mb-6 p-4 bg-gradient-primary text-primary-foreground rounded-lg shadow-strong">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <span className="text-sm">{profile?.display_name} ({profile?.role})</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <LogOut className="h-4 w-4 mr-2" />
              로그아웃
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-muted/30 shadow-soft border border-border rounded-lg p-1">
              <TabsTrigger 
                value="products" 
                className="font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                판매상품
              </TabsTrigger>
              <TabsTrigger 
                value="orders" 
                className="font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                주문내역
              </TabsTrigger>
              <TabsTrigger 
                value="online-products" 
                className="font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                온라인상품
              </TabsTrigger>
              <TabsTrigger 
                value="online-orders" 
                className="font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                온라인 주문목록
              </TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-6">
              {showProductForm ? (
                <ProductForm
                  product={editingProduct}
                  onSave={handleSaveProduct}
                  onCancel={() => {
                    setShowProductForm(false);
                    setEditingProduct(undefined);
                  }}
                  onDelete={isAdmin ? handleDeleteProduct : undefined}
                />
              ) : (
                <ProductList
                  products={products}
                  onEditProduct={handleEditProduct}
                  filter={productFilter}
                  onFilterChange={setProductFilter}
                  canEdit={isManagerOrAdmin}
                  canDelete={isAdmin}
                />
              )}

              {!showProductForm && isManagerOrAdmin && (
                <>
                  <FloatingButton
                    icon={Plus}
                    onClick={() => setShowProductForm(true)}
                    variant="primary"
                  >
                    상품 등록
                  </FloatingButton>

                  <FloatingButton
                    icon={Download}
                    onClick={handleImageGenerateClick}
                    variant="accent"
                    className="bottom-24"
                  >
                    이미지 자동생성
                  </FloatingButton>
                </>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-6">
              <OrderUpload />
            </TabsContent>

            <TabsContent value="online-products" className="space-y-6">
              {showOnlineProductForm ? (
                <OnlineProductForm
                  onlineProduct={editingOnlineProduct}
                  products={products}
                  onSave={handleSaveOnlineProduct}
                  onCancel={() => {
                    setShowOnlineProductForm(false);
                    setEditingOnlineProduct(undefined);
                  }}
                  onDelete={isAdmin ? handleDeleteOnlineProduct : undefined}
                />
              ) : (
                <OnlineProductList
                  onlineProducts={onlineProducts}
                  onEditProduct={handleEditOnlineProduct}
                  canEdit={isManagerOrAdmin}
                  canDelete={isAdmin}
                />
              )}

              {!showOnlineProductForm && isManagerOrAdmin && (
                <FloatingButton
                  icon={Plus}
                  onClick={() => setShowOnlineProductForm(true)}
                  variant="primary"
                >
                  온라인상품 등록
                </FloatingButton>
              )}
            </TabsContent>

            <TabsContent value="online-orders" className="space-y-6">
              <OnlineOrderList />
            </TabsContent>
          </Tabs>

          {/* 이미지 생성 옵션 다이얼로그 */}
          <ImageGenerationDialog
            open={showImageGenerationDialog}
            onOpenChange={setShowImageGenerationDialog}
            onSelectOption={handleImageGenerate}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}
