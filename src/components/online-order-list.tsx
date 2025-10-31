'use client'

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Package, Edit, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Product } from "@/hooks/useProducts";
import { OnlineProduct } from "@/hooks/useOnlineProducts";

type OnlineOrder = {
  id: number;
  online_product_id: number;
  quantity: number;
  total_price: number;
  payment_status: '입금대기' | '입금완료';
  name: string;
  mobile: string;
  orderer_mobile: string;
  address: string;
  address_detail?: string | null;
  postcode?: string | null;
  created_at: string;
  updated_at: string;
  online_product: OnlineProduct;
  orderer_name?: string | null;
};

export function OnlineOrderList() {
  const [onlineOrders, setOnlineOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [editingOrder, setEditingOrder] = useState<OnlineOrder | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    quantity: 1,
    total_price: 0,
    payment_status: '입금대기' as '입금대기' | '입금완료',
    name: '',
    mobile: '',
    address: '',
    address_detail: '',
    postcode: '',
  });

  useEffect(() => {
    loadOnlineOrders();
  }, []);

  const loadOnlineOrders = async () => {
    setLoading(true);
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
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading online orders:', error);
        toast.error('주문 목록을 불러오는데 실패했습니다.');
        return;
      }

      // Get unique orderer mobiles
      const ordererMobiles = [...new Set((data || []).map((item: any) => item.orderer_mobile))];
      
      // Fetch user names for orderers
      const { data: usersData } = await supabase
        .from('users')
        .select('mobile, name')
        .in('mobile', ordererMobiles);

      const userMap = new Map(
        (usersData || []).map((user: any) => [user.mobile, user.name])
      );

      const transformed = (data || []).map((item: any) => ({
        ...item,
        online_product: {
          ...item.online_product,
          product: item.online_product.product as Product,
        } as OnlineProduct,
        orderer_name: userMap.get(item.orderer_mobile) || null,
      }));

      setOnlineOrders(transformed);
    } catch (error) {
      console.error('Error loading online orders:', error);
      toast.error('주문 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (orderId: number, newStatus: '입금대기' | '입금완료') => {
    setUpdatingStatus(orderId);
    try {
      const { error } = await supabase
        .from('online_orders')
        .update({ payment_status: newStatus })
        .eq('id', orderId);

      if (error) {
        console.error('Error updating payment status:', error);
        toast.error('입금상태 변경에 실패했습니다.');
        return;
      }

      setOnlineOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, payment_status: newStatus } : order
        )
      );

      toast.success('입금상태가 변경되었습니다.');
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('입금상태 변경에 실패했습니다.');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleEditClick = (order: OnlineOrder) => {
    setEditingOrder(order);
    setEditForm({
      quantity: order.quantity,
      total_price: order.total_price,
      payment_status: order.payment_status,
      name: order.name,
      mobile: order.mobile,
      address: order.address,
      address_detail: order.address_detail || '',
      postcode: order.postcode || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder) return;

    if (!editForm.name.trim()) {
      toast.error('받는분 이름을 입력해주세요.');
      return;
    }

    if (!editForm.mobile.trim()) {
      toast.error('받는분 휴대폰 번호를 입력해주세요.');
      return;
    }

    if (!editForm.address.trim()) {
      toast.error('주소를 입력해주세요.');
      return;
    }

    if (editForm.quantity <= 0) {
      toast.error('수량은 1개 이상이어야 합니다.');
      return;
    }

    if (editForm.total_price <= 0) {
      toast.error('총 가격은 0원보다 커야 합니다.');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('online_orders')
        .update({
          quantity: editForm.quantity,
          total_price: editForm.total_price,
          payment_status: editForm.payment_status,
          name: editForm.name.trim(),
          mobile: editForm.mobile.trim(),
          address: editForm.address.trim(),
          address_detail: editForm.address_detail.trim() || null,
          postcode: editForm.postcode.trim() || null,
        })
        .eq('id', editingOrder.id);

      if (error) {
        console.error('Error updating order:', error);
        toast.error('주문 수정에 실패했습니다.');
        return;
      }

      toast.success('주문이 수정되었습니다.');
      setIsEditDialogOpen(false);
      setEditingOrder(null);
      loadOnlineOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('주문 수정에 실패했습니다.');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrders = onlineOrders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.orderer_name?.toLowerCase().includes(query) ||
      order.orderer_mobile.includes(query) ||
      order.online_product.product.name.toLowerCase().includes(query) ||
      order.online_product_id.toString().includes(query)
    );
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

  const formatMobile = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('010')) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return cleaned;
  };

  const getSaleStatus = (order: OnlineOrder): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (!order.online_product) {
      return { label: '-', variant: 'outline' };
    }

    const now = new Date();
    const start = new Date(order.online_product.start_datetime);
    const end = new Date(order.online_product.end_datetime);

    if (now < start) {
      return { label: '판매전', variant: 'secondary' };
    } else if (now >= start && now <= end) {
      return { label: '판매중', variant: 'default' };
    } else {
      return { label: '판매종료', variant: 'outline' };
    }
  };

  const handleExportExcel = async () => {
    try {
      // 판매 종료 + 입금완료인 주문만 필터링
      const exportableOrders = filteredOrders.filter(order => {
        const saleStatus = getSaleStatus(order);
        return saleStatus.label === '판매종료' && order.payment_status === '입금완료';
      });

      if (exportableOrders.length === 0) {
        toast.error('엑셀로 내보낼 주문이 없습니다. (판매종료 + 입금완료 주문만 가능)');
        return;
      }

      // xlsx 라이브러리 동적 import
      const XLSX = await import('xlsx');

      // 엑셀 데이터 준비
      const excelData = exportableOrders.map((order) => {
        const fullAddress = order.postcode 
          ? `[${order.postcode}] ${order.address}${order.address_detail ? ` ${order.address_detail}` : ''}`
          : `${order.address}${order.address_detail ? ` ${order.address_detail}` : ''}`;

        return {
          '주문ID': order.id,
          '온라인상품ID': order.online_product_id,
          '상품명': order.online_product.product.name,
          '수량': order.quantity,
          '단가': order.online_product.product.price,
          '총 가격': order.total_price,
          '받는분 이름': order.name,
          '받는분 휴대폰': formatMobile(order.mobile),
          '주소': fullAddress,
          '주문자 이름': order.orderer_name || '-',
          '주문자 휴대폰': formatMobile(order.orderer_mobile),
          '주문일시': formatDateTime(order.created_at),
          '입금상태': order.payment_status,
        };
      });

      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // 컬럼 너비 설정
      const columnWidths = [
        { wch: 8 },  // 주문ID
        { wch: 12 }, // 온라인상품ID
        { wch: 20 }, // 상품명
        { wch: 8 },  // 수량
        { wch: 12 }, // 단가
        { wch: 12 }, // 총 가격
        { wch: 12 }, // 받는분 이름
        { wch: 15 }, // 받는분 휴대폰
        { wch: 40 }, // 주소
        { wch: 12 }, // 주문자 이름
        { wch: 15 }, // 주문자 휴대폰
        { wch: 18 }, // 주문일시
        { wch: 10 }, // 입금상태
      ];
      worksheet['!cols'] = columnWidths;

      // 워크북 생성
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '송장데이터');

      // 파일명 생성 (현재 날짜)
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const fileName = `송장데이터_${dateStr}.xlsx`;

      // 엑셀 파일 다운로드 (스타일 포함)
      XLSX.writeFile(workbook, fileName, {
        cellStyles: true,
      });

      toast.success(`${exportableOrders.length}개의 주문이 엑셀로 내보내졌습니다.`);
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('엑셀 파일 생성에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">주문 목록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="온라인상품ID, 주문자 이름, 휴대폰, 상품명으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={handleExportExcel}
          className="whitespace-nowrap"
        >
          <Download className="h-4 w-4 mr-2" />
          송장 엑셀
        </Button>
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">주문이 없습니다.</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <Card 
              key={order.id} 
              className={`bg-gradient-card shadow-medium ${
                order.payment_status === '입금완료' 
                  ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                  : ''
              }`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-foreground">
                    [{order.online_product_id}] {order.online_product.product.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditClick(order)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Select
                      value={order.payment_status}
                      onValueChange={(value: '입금대기' | '입금완료') => handleStatusChange(order.id, value)}
                      disabled={updatingStatus === order.id}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="입금대기">입금대기</SelectItem>
                        <SelectItem value="입금완료">입금완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">온라인상품ID:</span>
                    <span className="ml-2 font-medium">{order.online_product_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">판매상태:</span>
                    <span className="ml-2">
                      <Badge variant={getSaleStatus(order).variant}>
                        {getSaleStatus(order).label}
                      </Badge>
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">수량:</span>
                    <span className="ml-2 font-medium">{order.quantity}개</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">총 가격:</span>
                    <span className="ml-2 font-bold text-primary">{order.total_price.toLocaleString()}원</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">주문자:</span>
                    <span className="ml-2 font-medium">
                      {order.orderer_name || '-'} ({formatMobile(order.orderer_mobile)})
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">주문일시:</span>
                    <span className="ml-2 font-medium">{formatDateTime(order.created_at)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block bg-card rounded-lg shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-4 text-sm font-medium">온라인상품ID</th>
                <th className="text-left p-4 text-sm font-medium">주문일시</th>
                <th className="text-left p-4 text-sm font-medium">상품명</th>
                <th className="text-left p-4 text-sm font-medium">판매상태</th>
                <th className="text-left p-4 text-sm font-medium">수량<br />총 가격</th>
                <th className="text-left p-4 text-sm font-medium">주문자<br />주문자 휴대폰</th>
                <th className="text-center p-4 text-sm font-medium">입금상태</th>
                <th className="text-center p-4 text-sm font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    주문이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const saleStatus = getSaleStatus(order);
                  return (
                    <tr 
                      key={order.id} 
                      className={`border-b border-border ${
                        order.payment_status === '입금완료' 
                          ? 'bg-green-50 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900 border-green-200 dark:border-green-800' 
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <td className="p-4 text-sm font-medium">
                        {order.online_product_id}
                      </td>
                      <td className="p-4 text-sm">
                        {formatDateTime(order.created_at)}
                      </td>
                      <td className="p-4 text-sm">
                        <div className="font-medium">{order.online_product.product.name}</div>
                      </td>
                      <td className="p-4 text-sm">
                        <Badge variant={saleStatus.variant}>
                          {saleStatus.label}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm whitespace-pre-line">
                        {order.quantity}개{'\n'}
                        <span className="font-bold text-primary">{order.total_price.toLocaleString()}원</span>
                      </td>
                      <td className="p-4 text-sm whitespace-pre-line">
                        {order.orderer_name || '-'}
                        {'\n'}
                        {formatMobile(order.orderer_mobile)}
                      </td>
                      <td className="p-4 text-center text-sm">
                        <Select
                          value={order.payment_status}
                          onValueChange={(value: '입금대기' | '입금완료') => handleStatusChange(order.id, value)}
                          disabled={updatingStatus === order.id}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="입금대기">입금대기</SelectItem>
                            <SelectItem value="입금완료">입금완료</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-4 text-center text-sm">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(order)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>주문 수정</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <div className="space-y-4 mt-4">
              {/* Read-only fields */}
              <div className="space-y-2">
                <Label>상품명</Label>
                <Input
                  value={editingOrder.online_product.product.name}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>주문일시</Label>
                <Input
                  value={formatDateTime(editingOrder.created_at)}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-quantity">수량</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) => setEditForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-total-price">총 가격</Label>
                  <Input
                    id="edit-total-price"
                    type="number"
                    value={editForm.total_price}
                    onChange={(e) => setEditForm(prev => ({ ...prev, total_price: parseInt(e.target.value) || 0 }))}
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-payment-status">입금상태</Label>
                <Select
                  value={editForm.payment_status}
                  onValueChange={(value: '입금대기' | '입금완료') => setEditForm(prev => ({ ...prev, payment_status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="입금대기">입금대기</SelectItem>
                    <SelectItem value="입금완료">입금완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-name">받는분 이름</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="받는분 이름"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-mobile">받는분 휴대폰</Label>
                <Input
                  id="edit-mobile"
                  type="tel"
                  value={editForm.mobile}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 11) {
                      setEditForm(prev => ({ ...prev, mobile: value }));
                    }
                  }}
                  placeholder="010-0000-0000"
                  maxLength={11}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-postcode">우편번호</Label>
                <Input
                  id="edit-postcode"
                  value={editForm.postcode}
                  onChange={(e) => setEditForm(prev => ({ ...prev, postcode: e.target.value }))}
                  placeholder="우편번호"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-address">주소</Label>
                <Input
                  id="edit-address"
                  value={editForm.address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="주소"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-address-detail">상세주소</Label>
                <Input
                  id="edit-address-detail"
                  value={editForm.address_detail}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address_detail: e.target.value }))}
                  placeholder="상세주소"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isUpdating}
                >
                  취소
                </Button>
                <Button
                  onClick={handleUpdateOrder}
                  disabled={isUpdating}
                >
                  {isUpdating ? '수정 중...' : '수정하기'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

