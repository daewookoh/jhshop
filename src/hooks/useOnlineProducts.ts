'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Product } from '@/hooks/useProducts';
import type { Tables } from '@/integrations/supabase/types';

export type OnlineProduct = Tables<'online_products'> & {
  product: Product;
};

export function useOnlineProducts() {
  const [onlineProducts, setOnlineProducts] = useState<OnlineProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOnlineProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('online_products')
        .select(`
          *,
          product:products(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our type
      const transformed = (data || []).map((item: any) => ({
        ...item,
        product: item.product as Product,
      }));

      setOnlineProducts(transformed);
    } catch (error) {
      console.error('Error fetching online products:', error);
      toast.error('온라인상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOnlineProducts();
  }, []);

  const addOnlineProduct = async (data: {
    product_id: string;
    start_datetime: string;
    end_datetime: string;
    available_quantity: number;
    shipping_fee: number;
  }) => {
    try {
      const { data: newItem, error } = await supabase
        .from('online_products')
        .insert(data)
        .select(`
          *,
          product:products(*)
        `)
        .single();

      if (error) throw error;

      const transformed: OnlineProduct = {
        ...newItem,
        product: newItem.product as Product,
      };

      setOnlineProducts((prev) => [transformed, ...prev]);
      toast.success('온라인상품이 등록되었습니다.');
      return true;
    } catch (error) {
      console.error('Error adding online product:', error);
      toast.error('온라인상품 등록에 실패했습니다.');
      return false;
    }
  };

  const updateOnlineProduct = async (
    id: number,
    data: {
      product_id: string;
      start_datetime: string;
      end_datetime: string;
      available_quantity: number;
      shipping_fee: number;
    }
  ) => {
    try {
      const { data: updatedItem, error } = await supabase
        .from('online_products')
        .update(data)
        .eq('id', id)
        .select(`
          *,
          product:products(*)
        `)
        .single();

      if (error) throw error;

      const transformed: OnlineProduct = {
        ...updatedItem,
        product: updatedItem.product as Product,
      };

      setOnlineProducts((prev) =>
        prev.map((item) => (item.id === id ? transformed : item))
      );
      toast.success('온라인상품이 수정되었습니다.');
      return true;
    } catch (error) {
      console.error('Error updating online product:', error);
      toast.error('온라인상품 수정에 실패했습니다.');
      return false;
    }
  };

  const deleteOnlineProduct = async (id: number) => {
    try {
      const { error } = await supabase
        .from('online_products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOnlineProducts((prev) => prev.filter((item) => item.id !== id));
      toast.success('온라인상품이 삭제되었습니다.');
      return true;
    } catch (error) {
      console.error('Error deleting online product:', error);
      toast.error('온라인상품 삭제에 실패했습니다.');
      return false;
    }
  };

  return {
    onlineProducts,
    loading,
    addOnlineProduct,
    updateOnlineProduct,
    deleteOnlineProduct,
    refetch: fetchOnlineProducts,
  };
}

