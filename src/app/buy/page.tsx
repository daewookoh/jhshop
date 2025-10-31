'use client'

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LogIn, AlertCircle, LogOut, ShoppingCart, Package, Search, Copy, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Tables } from "@/integrations/supabase/types";
import { Product } from "@/hooks/useProducts";
import { OnlineProduct } from "@/hooks/useOnlineProducts";
import DaumPostcode from "react-daum-postcode";
import { Constants } from "@/lib/constants";

type User = Tables<'users'>;
type OnlineOrder = Tables<'online_orders'> & {
  online_product: OnlineProduct;
};

function BuyPageContent() {
  const searchParams = useSearchParams();
  const productId = searchParams?.get('id') || null;
  
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [ordererName, setOrdererName] = useState("");
  const [ordererMobile, setOrdererMobile] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [postcode, setPostcode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [onlineProduct, setOnlineProduct] = useState<OnlineProduct | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [activeTab, setActiveTab] = useState("buy");
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [showOrderHistoryDialog, setShowOrderHistoryDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Check if user is already logged in
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUserId = localStorage.getItem('buy_user_id');
        if (storedUserId) {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', storedUserId)
            .single();
          
          if (!error && data) {
            setUser(data);
          } else {
            localStorage.removeItem('buy_user_id');
          }
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    
    loadUser();
  }, []);

  // Load online orders for logged in user
  useEffect(() => {
    const loadOnlineOrders = async () => {
      if (!user || !user.mobile) return;

      setLoadingOrders(true);
      try {
        const { data, error } = await supabase
          .from('online_orders')
          .select(`
            *,
            online_product:online_products(
              *,
              product:products(*)
            )
          `)
          .eq('mobile', user.mobile)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading online orders:', error);
          return;
        }

        // Transform the data
        const transformed = (data || []).map((item: any) => ({
          ...item,
          online_product: {
            ...item.online_product,
            product: item.online_product.product as Product,
          } as OnlineProduct,
        }));

        setOnlineOrders(transformed);
      } catch (error) {
        console.error('Error loading online orders:', error);
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOnlineOrders();
  }, [user]);

  // Set default orderer info from user
  useEffect(() => {
    if (user && user.name && user.mobile) {
      // Only set default values if fields are empty
      setOrdererName(prev => prev || user.name || '');
      setOrdererMobile(prev => prev || user.mobile || '');
    }
  }, [user]);

  // Load online product if id is provided
  useEffect(() => {
    const loadOnlineProduct = async () => {
      if (!productId) return;
      
      setLoadingProduct(true);
      try {
        const { data, error } = await supabase
          .from('online_products')
          .select(`
            *,
            product:products(*)
          `)
          .eq('id', parseInt(productId))
          .single();

        if (error) {
          console.error('Error loading online product:', error);
          toast.error('상품을 찾을 수 없습니다.');
          return;
        }

        const transformed: OnlineProduct = {
          ...data,
          product: data.product as Product,
        };

        setOnlineProduct(transformed);
      } catch (error) {
        console.error('Error loading online product:', error);
        toast.error('상품을 불러오는데 실패했습니다.');
      } finally {
        setLoadingProduct(false);
      }
    };

    loadOnlineProduct();
  }, [productId]);

  // Auto focus input when component mounts
  useEffect(() => {
    if (!user && inputRef.current) {
      inputRef.current.focus();
    } else if (user && !user.name && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [user]);

  // Validate mobile number format (010xxxxxxxx)
  const validateMobile = (phone: string): boolean => {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it matches 010xxxxxxxx format (11 digits starting with 010)
    return /^010\d{8}$/.test(cleaned);
  };

  // Format mobile number for display (010-xxxx-xxxx)
  const formatMobile = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('010')) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return cleaned;
  };

  // Handle input change - only allow 8 digits after 010
  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // 숫자만 추출
    if (value.length <= 8) {
      setMobile(value);
    }
  };

  // Get full mobile number (010 + user input)
  const getFullMobile = (): string => {
    return `010${mobile}`;
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!mobile || mobile.length !== 8) {
      toast.error("휴대폰 번호 8자리를 모두 입력해주세요.");
      return;
    }

    const fullMobile = getFullMobile();
    
    // Validate mobile format
    if (!validateMobile(fullMobile)) {
      toast.error("휴대폰 번호 형식이 올바르지 않습니다.");
      return;
    }

    setIsLoading(true);
    try {
      // Check if user exists
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('mobile', fullMobile)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 is "No rows found" error, which is expected if user doesn't exist
        console.error("Error fetching user:", fetchError);
        toast.error("로그인 중 오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }

      let userData: User;

      if (existingUser) {
        // User exists, use existing data
        userData = existingUser;
        toast.success("로그인되었습니다.");
      } else {
        // User doesn't exist, create new user
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({
            mobile: fullMobile,
            name: null, // name은 나중에 업데이트할 수 있도록 null로 설정
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating user:", insertError);
          toast.error("회원가입 중 오류가 발생했습니다.");
          setIsLoading(false);
          return;
        }

        userData = newUser;
        toast.success("회원가입 및 로그인되었습니다.");
      }

      // Save user to localStorage
      localStorage.setItem('buy_user_id', userData.id);
      setUser(userData);
      setMobile("");
    } catch (error) {
      console.error("Login error:", error);
      toast.error("로그인 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle name registration
  const handleNameRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || name.trim().length === 0) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    if (!user) {
      toast.error("로그인 정보를 찾을 수 없습니다.");
      return;
    }

    setIsLoading(true);
    try {
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ name: name.trim() })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Error updating user name:", updateError);
        toast.error("이름 등록 중 오류가 발생했습니다.");
        setIsLoading(false);
        return;
      }

      setUser(updatedUser);
      setName("");
      toast.success("이름이 등록되었습니다.");
    } catch (error) {
      console.error("Name registration error:", error);
      toast.error("이름 등록 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('buy_user_id');
    setUser(null);
    setMobile("");
    setName("");
    toast.success("로그아웃되었습니다.");
  };

  // Handle address search completion
  const handleAddressComplete = (data: any) => {
    let fullAddress = data.address;
    let extraAddress = '';

    if (data.addressType === 'R') {
      if (data.bname !== '') {
        extraAddress += data.bname;
      }
      if (data.buildingName !== '') {
        extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      }
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }

    setAddress(fullAddress);
    setPostcode(data.zonecode || '');
    setShowAddressDialog(false);
  };

  // Get unique orders by address (only first order for each address)
  const getUniqueOrdersByAddress = (): OnlineOrder[] => {
    if (!onlineOrders || onlineOrders.length === 0) return [];
    
    const addressMap = new Map<string, OnlineOrder>();
    onlineOrders.forEach(order => {
      const addressKey = order.address.trim();
      if (!addressMap.has(addressKey)) {
        addressMap.set(addressKey, order);
      }
    });
    
    return Array.from(addressMap.values());
  };

  // Handle order selection from history
  const handleSelectOrderFromHistory = (order: OnlineOrder) => {
    setOrdererName(order.name);
    setOrdererMobile(order.mobile);
    
    // Extract postcode if exists
    let addressToUse = order.address;
    const postcodeMatch = addressToUse.match(/\[(\d{5,6})\]/);
    if (postcodeMatch) {
      setPostcode(postcodeMatch[1]);
      // Remove postcode from address
      addressToUse = addressToUse.replace(/\[\d{5,6}\]\s*/, '').trim();
    } else {
      setPostcode('');
    }
    
    // If address_detail exists in order, use it
    // Otherwise, try to extract from address
    if ((order as any).address_detail) {
      setAddress(addressToUse);
      setAddressDetail((order as any).address_detail);
    } else {
      // Try to split address into main and detail
      // Common pattern: "주소 주소" or "주소 상세주소"
      // Simple approach: if address contains multiple lines or certain patterns, split
      const addressLines = addressToUse.split(/\n/);
      if (addressLines.length > 1) {
        setAddress(addressLines[0]);
        setAddressDetail(addressLines.slice(1).join(' '));
      } else {
        // Try to detect if there's a detail part (usually shorter, comes after main address)
        const parts = addressToUse.split(/\s+/);
        if (parts.length > 3) {
          // Assume last 1-2 words might be detail
          const mainAddress = parts.slice(0, -1).join(' ');
          const detailAddress = parts[parts.length - 1];
          setAddress(mainAddress);
          setAddressDetail(detailAddress);
        } else {
          setAddress(addressToUse);
          setAddressDetail('');
        }
      }
    }
    
    setShowOrderHistoryDialog(false);
    toast.success('주문정보가 입력되었습니다.');
  };

  // Get full address with detail
  const getFullAddress = (): string => {
    if (addressDetail.trim()) {
      return `${address} ${addressDetail}`.trim();
    }
    return address;
  };

  // Format datetime for display
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

  // Calculate total price
  const calculateTotalPrice = (): number => {
    if (!onlineProduct) return 0;
    return onlineProduct.product.price * quantity;
  };

  // Get product status
  const getProductStatus = () => {
    if (!onlineProduct) return null;

    const now = new Date();
    const start = new Date(onlineProduct.start_datetime);
    const end = new Date(onlineProduct.end_datetime);

    if (now < start) {
      return {
        type: 'before',
        message: `${formatDateTime(onlineProduct.start_datetime)}부터 판매됩니다.`,
      };
    }

    if (now > end) {
      return {
        type: 'ended',
        message: '판매가 종료되었습니다.',
      };
    }

    if (onlineProduct.available_quantity === 0) {
      return {
        type: 'soldout',
        message: '마감되었습니다.',
      };
    }

    return {
      type: 'available',
      message: null,
    };
  };

  // Get payment deadline (마감일 오후 12:00)
  const getPaymentDeadline = (): string => {
    if (!onlineProduct) return '';
    const endDate = new Date(onlineProduct.end_datetime);
    endDate.setHours(12, 0, 0, 0);
    return endDate.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // Handle order
  const handleOrder = async () => {
    if (!user || !user.name) {
      toast.error('로그인 후 주문할 수 있습니다.');
      return;
    }

    if (!onlineProduct) {
      toast.error('상품 정보를 불러올 수 없습니다.');
      return;
    }

    const status = getProductStatus();
    if (status?.type !== 'available') {
      toast.error(status?.message || '주문할 수 없습니다.');
      return;
    }

    if (quantity <= 0) {
      toast.error('수량을 입력해주세요.');
      return;
    }

    if (quantity > onlineProduct.available_quantity) {
      toast.error(`재고수량 ${onlineProduct.available_quantity}개`);
      return;
    }

    if (!ordererName.trim()) {
      toast.error('입금하실분의 이름을 입력해주세요.');
      return;
    }

    if (!ordererMobile.trim()) {
      toast.error('입금하실분의 휴대폰 번호를 입력해주세요.');
      return;
    }

    if (!address.trim()) {
      toast.error('주소를 입력해주세요.');
      return;
    }

    const fullAddress = getFullAddress();

    setIsLoading(true);
    try {
      // Create online_order
      const { error: onlineOrderError } = await supabase
        .from('online_orders')
        .insert({
          online_product_id: onlineProduct.id,
          quantity: quantity,
          total_price: calculateTotalPrice(),
          payment_status: '입금대기',
          name: ordererName.trim(),
          mobile: ordererMobile.trim(),
          orderer_mobile: user.mobile,
          address: address.trim(),
          address_detail: addressDetail.trim() || null,
          postcode: postcode.trim() || null,
        });

      if (onlineOrderError) {
        console.error('Error creating online order:', onlineOrderError);
        toast.error('주문 등록에 실패했습니다.');
        setIsLoading(false);
        return;
      }

      // Create order (for backward compatibility)
      const today = new Date().toISOString().split('T')[0];
      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          nickname: user.name,
          product_name: onlineProduct.product.name,
          quantity: quantity,
          price: onlineProduct.product.price,
          total_price: calculateTotalPrice(),
          order_date: today,
        });

      if (orderError) {
        console.error('Error creating order:', orderError);
        // Continue even if order creation fails
      }

      // Update available quantity
      const { error: updateError } = await supabase
        .from('online_products')
        .update({
          available_quantity: onlineProduct.available_quantity - quantity,
        })
        .eq('id', onlineProduct.id);

      if (updateError) {
        console.error('Error updating quantity:', updateError);
        // Order was created but quantity update failed - this is a problem but we'll continue
      }

      toast.success('주문이 완료되었습니다.');
      setQuantity(1);
      setOrdererName("");
      setOrdererMobile("");
      setAddress("");
      setAddressDetail("");
      setPostcode("");
      
      // Switch to orders tab
      setActiveTab("orders");
      
      // Reload product and orders
      if (productId) {
        const { data, error } = await supabase
          .from('online_products')
          .select(`
            *,
            product:products(*)
          `)
          .eq('id', parseInt(productId))
          .single();

        if (!error && data) {
          setOnlineProduct({
            ...data,
            product: data.product as Product,
          });
        }
      }

      // Reload orders
      if (user.mobile) {
        const { data, error } = await supabase
          .from('online_orders')
          .select(`
            *,
            online_product:online_products(
              *,
              product:products(*)
            )
          `)
          .eq('mobile', user.mobile)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const transformed = (data || []).map((item: any) => ({
            ...item,
            online_product: {
              ...item.online_product,
              product: item.online_product.product as Product,
            } as OnlineProduct,
          }));
          setOnlineOrders(transformed);
        }
      }
    } catch (error) {
      console.error('Order error:', error);
      toast.error('주문 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">처리 중...</p>
        </div>
      </div>
    );
  }

  // Show name registration form if user is logged in but name is missing
  if (user && !user.name) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="bg-gradient-card shadow-medium">
            <CardHeader className="pb-4">
              <CardTitle className="text-center text-foreground">실명 등록</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  입금하실분의 실명을 등록해 주세요. 등록된 이름은 변경이 불가능 합니다.
                </AlertDescription>
              </Alert>
              <form onSubmit={handleNameRegistration} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    ref={nameInputRef}
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="실명을 입력하세요"
                    required
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "등록 중..." : "등록하기"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show logged in state with header
  if (user && user.name) {
    const status = getProductStatus();
    const paymentDeadline = getPaymentDeadline();

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-background">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-medium text-foreground">{user.name}</span>
                  <span className="text-muted-foreground mx-2">•</span>
                  <span className="text-muted-foreground">{formatMobile(user.mobile)}</span>
                </div>
              </div>
              <Button 
                onClick={handleLogout} 
                variant="outline" 
                size="sm"
              >
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </header>
        
        {/* Product content */}
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 bg-muted/30 shadow-soft border border-border rounded-lg p-1">
              <TabsTrigger 
                value="buy" 
                className="font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                구매하기
              </TabsTrigger>
              <TabsTrigger 
                value="orders" 
                className="font-medium text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                주문기록
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buy" className="space-y-6">
              {!productId ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">상품 ID가 제공되지 않았습니다.</p>
                </div>
              ) : loadingProduct ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">상품을 불러오는 중...</p>
                </div>
              ) : !onlineProduct ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">상품을 찾을 수 없습니다.</p>
                </div>
              ) : (
                <Card className="bg-gradient-card shadow-medium">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-center text-foreground flex-1">상품 주문</CardTitle>
                      {onlineOrders.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowOrderHistoryDialog(true)}
                          className="ml-4"
                        >
                          <History className="h-4 w-4 mr-2" />
                          주문정보 불러오기
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Status Alert */}
                    {status && status.type !== 'available' && (
                      <Alert variant={status.type === 'soldout' || status.type === 'ended' ? 'destructive' : 'default'}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{status.message}</AlertDescription>
                      </Alert>
                    )}

                    {/* Top Section: Image/Description and Form */}
                    {status?.type === 'available' && (
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Left: Product Image and Description */}
                        <div className="w-full md:w-1/2 flex-shrink-0 space-y-4">
                          {onlineProduct.product.image_url && (
                            <div className="aspect-square max-w-md mx-auto md:mx-0">
                              <img
                                src={onlineProduct.product.image_url}
                                alt={onlineProduct.product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            </div>
                          )}
                          <div>
                            <h2 className="text-2xl font-bold text-foreground mb-2 whitespace-pre-line">
                              {onlineProduct.product.name}
                            </h2>
                            <p className="text-3xl font-bold text-primary">
                              {onlineProduct.product.price.toLocaleString()}원
                            </p>
                          </div>
                        </div>

                        {/* Right: Order Form */}
                        <div className="flex-1 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="quantity">수량</Label>
                            <Input
                              id="quantity"
                              type="number"
                              value={quantity}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 1;
                                setQuantity(Math.max(1, value));
                              }}
                              min="1"
                              max={onlineProduct.available_quantity}
                              className="text-center"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ordererName">받는분 이름</Label>
                            <Input
                              id="ordererName"
                              type="text"
                              value={ordererName}
                              onChange={(e) => setOrdererName(e.target.value)}
                              placeholder="받는분 이름"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="ordererMobile">받는분 휴대폰</Label>
                            <Input
                              id="ordererMobile"
                              type="tel"
                              value={ordererMobile}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                if (value.length <= 11) {
                                  setOrdererMobile(value);
                                }
                              }}
                              placeholder="받는분 휴대폰 010-0000-0000"
                              maxLength={11}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="address">주소</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAddressDialog(true)}
                              >
                                <Search className="h-4 w-4 mr-2" />
                                검색
                              </Button>
                            </div>
                            <Input
                              id="address"
                              value={address}
                              placeholder="주소 검색 버튼을 클릭하세요"
                              readOnly
                              className="w-full"
                              required
                            />
                            <Input
                              id="addressDetail"
                              value={addressDetail}
                              onChange={(e) => setAddressDetail(e.target.value)}
                              placeholder="상세주소를 입력하세요 (선택사항)"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bottom Section: Total Price and Order Button */}
                    {status?.type === 'available' && (
                      <div className="border-t pt-6 space-y-4">
                        {paymentDeadline && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              입금마감기한: {paymentDeadline} 오후 12:00
                            </AlertDescription>
                          </Alert>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-medium text-muted-foreground">총 결제금액</span>
                          <span className="text-3xl font-bold text-primary">
                            {calculateTotalPrice().toLocaleString()}원
                          </span>
                        </div>
                        <Button
                          onClick={handleOrder}
                          className="w-full"
                          size="lg"
                          disabled={isLoading || quantity <= 0 || quantity > onlineProduct.available_quantity}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          {isLoading ? '주문 처리 중...' : '주문하기'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="orders" className="space-y-6">
              {/* 입금계좌 정보 */}
              <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="text-sm font-medium text-muted-foreground">입금계좌</div>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                      <div className="text-2xl font-bold text-foreground">
                        {Constants.depositAccount.bank}
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {Constants.depositAccount.accountNumber}
                        {Constants.depositAccount.accountHolder && (
                          <span className="text-lg font-normal text-muted-foreground ml-2">
                            ({Constants.depositAccount.accountHolder})
                          </span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `${Constants.depositAccount.bank} ${Constants.depositAccount.accountNumber}`
                          );
                          toast.success('계좌번호가 복사되었습니다.');
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    {user && user.name && (
                      <div className="text-sm text-muted-foreground">
                        입금자명: <span className="font-medium text-foreground">{user.name}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {loadingOrders ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">주문기록을 불러오는 중...</p>
                </div>
              ) : onlineOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">주문기록이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {onlineOrders.map((order) => (
                    <Card key={order.id} className="bg-gradient-card shadow-medium">
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg font-bold text-foreground">
                            {order.online_product.product.name}
                          </CardTitle>
                          <Badge variant={order.payment_status === '입금완료' ? 'default' : 'secondary'}>
                            {order.payment_status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">수량:</span>
                            <span className="ml-2 font-medium">{order.quantity}개</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">총 가격:</span>
                            <span className="ml-2 font-bold text-primary">{order.total_price.toLocaleString()}원</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">받는분:</span>
                            <span className="ml-2 font-medium">{order.name}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">받는분 휴대폰:</span>
                            <span className="ml-2 font-medium">{formatMobile(order.mobile)}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">주소:</span>
                            <span className="ml-2 font-medium whitespace-pre-line">
                              {order.postcode && `[${order.postcode}] `}
                              {order.address}
                              {(order as any).address_detail && ` ${(order as any).address_detail}`}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">주문일시:</span>
                            <span className="ml-2 font-medium">{formatDateTime(order.created_at)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>

        {/* Address Search Dialog */}
        <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>주소 검색</DialogTitle>
            </DialogHeader>
            <DaumPostcode
              onComplete={handleAddressComplete}
              style={{ height: '600px' }}
            />
          </DialogContent>
        </Dialog>

        {/* Order History Dialog */}
        <Dialog open={showOrderHistoryDialog} onOpenChange={setShowOrderHistoryDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>주문정보 불러오기</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {getUniqueOrdersByAddress().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  불러올 주문정보가 없습니다.
                </div>
              ) : (
                getUniqueOrdersByAddress().map((order) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectOrderFromHistory(order)}
                  >
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{order.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatMobile(order.mobile)}
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {order.postcode && `[${order.postcode}] `}
                          {order.address}
                          {(order as any).address_detail && ` ${(order as any).address_detail}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          주문일: {formatDateTime(order.created_at)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Show login form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-gradient-card shadow-medium">
          <CardHeader className="pb-4">
            <CardTitle className="text-center text-foreground">로그인</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile">휴대폰 번호</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-foreground font-medium">
                    010
                  </div>
                  <div className="flex-1">
                    <Input
                      ref={inputRef}
                      id="mobile"
                      type="tel"
                      value={mobile}
                      onChange={handleMobileChange}
                      placeholder="12345678"
                      maxLength={8}
                      required
                      className="text-center"
                      autoFocus
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  휴대폰 번호 뒤 8자리를 입력하세요
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                <LogIn className="h-4 w-4 mr-2" />
                {isLoading ? "처리 중..." : "로그인"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Address Search Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>주소 검색</DialogTitle>
          </DialogHeader>
          <DaumPostcode
            onComplete={handleAddressComplete}
            style={{ height: '600px' }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BuyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    }>
      <BuyPageContent />
    </Suspense>
  );
}

