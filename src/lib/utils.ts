import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 이미지를 WebP 형식으로 변환하여 파일 용량을 줄입니다. (원본 해상도 유지)
 * @param file 원본 이미지 파일
 * @param quality WebP 품질 (0-1, 기본값: 0.9)
 * @returns WebP 형식의 Blob
 */
export async function convertToWebP(
  file: File,
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 원본 이미지 크기 그대로 사용 (해상도 유지)
      const { width, height } = img;

      // 캔버스 크기를 원본 이미지 크기로 설정
      canvas.width = width;
      canvas.height = height;

      // 이미지 그리기 (원본 크기 그대로)
      ctx?.drawImage(img, 0, 0, width, height);

      // WebP로 변환 (고품질 유지)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('WebP 변환에 실패했습니다.'));
          }
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('이미지 로드에 실패했습니다.'));
    };

    // 파일을 이미지로 로드
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('파일 읽기에 실패했습니다.'));
    };
    reader.readAsDataURL(file);
  });
}
