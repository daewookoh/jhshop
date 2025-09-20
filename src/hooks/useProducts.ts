'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { convertToWebP } from '@/lib/utils';

export interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  is_active: boolean;
  sale_date: string;
  created_at: string;
  updated_at: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        toast.error('상품 목록을 불러오는데 실패했습니다.');
        return;
      }

      setProducts(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('상품 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = async (productData: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (error) {
        console.error('Error adding product:', error);
        toast.error('상품 등록에 실패했습니다.');
        return false;
      }

      setProducts(prev => [data, ...prev]);
      toast.success('상품이 등록되었습니다.');
      return true;
    } catch (error) {
      console.error('Error:', error);
      toast.error('상품 등록에 실패했습니다.');
      return false;
    }
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating product:', error);
        toast.error('상품 수정에 실패했습니다.');
        return false;
      }

      setProducts(prev => prev.map(p => p.id === id ? data : p));
      toast.success('상품이 수정되었습니다.');
      return true;
    } catch (error) {
      console.error('Error:', error);
      toast.error('상품 수정에 실패했습니다.');
      return false;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting product:', error);
        toast.error('상품 삭제에 실패했습니다.');
        return false;
      }

      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('상품이 삭제되었습니다.');
      return true;
    } catch (error) {
      console.error('Error:', error);
      toast.error('상품 삭제에 실패했습니다.');
      return false;
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      // WebP 형식으로 변환 (원본 해상도 유지, 고품질)
      const webpBlob = await convertToWebP(file, 0.95);
      
      // WebP 파일명 생성
      const fileName = `${Date.now()}.webp`;
      const filePath = fileName;

      // WebP 파일을 File 객체로 변환
      const webpFile = new File([webpBlob], fileName, { type: 'image/webp' });

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, webpFile);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        toast.error('이미지 업로드에 실패했습니다.');
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error:', error);
      toast.error('이미지 업로드에 실패했습니다.');
      return null;
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return {
    products,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    uploadImage,
    refreshProducts: fetchProducts
  };
}