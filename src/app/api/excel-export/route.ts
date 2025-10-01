import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

interface OrderData {
  nickname: string;
  orderText: string;
  notes: string;
  products: {
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  sale_date: string;
  is_active: boolean;
}

export async function POST(request: NextRequest) {
  try {
    let XLSX: any;
    try {
      XLSX = await import('xlsx');
    } catch (error) {
      console.error('xlsx 라이브러리 import 실패:', error);
      return NextResponse.json({
        error: 'xlsx 라이브러리가 설치되지 않았습니다. 터미널에서 "npm install xlsx"를 실행해주세요.'
      }, { status: 500 });
    }

    const formData = await request.formData();
    const excelFile = formData.get('excelFile') as File;
    const date = formData.get('date') as string;
    const orders = JSON.parse(formData.get('orders') as string) as OrderData[];
    const products = JSON.parse(formData.get('products') as string) as Product[];

    if (!excelFile) {
      return NextResponse.json({ error: '엑셀 파일이 필요합니다.' }, { status: 400 });
    }
    
    if (!SPREADSHEET_ID) {
      return NextResponse.json({ error: '구글시트 ID가 설정되지 않았습니다.' }, { status: 500 });
    }

    // 먼저 구글시트에 데이터 작성
    const googleSheetsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/google-sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, orders, products })
    });

    if (!googleSheetsResponse.ok) {
      throw new Error('구글시트 작성에 실패했습니다.');
    }

    const googleSheetsData = await googleSheetsResponse.json();
    const googleSheetName = googleSheetsData.sheetName;
    const spreadsheetId = googleSheetsData.spreadsheetId || SPREADSHEET_ID;
    
    console.log('googleSheetName:', googleSheetName);
    console.log('spreadsheetId from response:', googleSheetsData.spreadsheetId);
    console.log('using spreadsheetId:', spreadsheetId);

    // 구글시트 생성 후 약간의 지연 추가
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 구글시트와 완전히 동일한 로직으로 데이터 생성 (OpenSSL 오류 방지)
    console.log('구글시트와 완전히 동일한 로직으로 데이터 생성 시작');

    // 컬럼 번호를 알파벳으로 변환하는 함수 (AA, AB 등 지원)
    const getColumnLetter = (columnNumber: number): string => {
      let result = '';
      while (columnNumber > 0) {
        columnNumber--;
        result = String.fromCharCode(65 + (columnNumber % 26)) + result;
        columnNumber = Math.floor(columnNumber / 26);
      }
      return result;
    }

    // 상품 목록을 판매일 역순, 상시는 마지막, 같은 판매일은 가나다순으로 정렬 (구글시트 API와 동일)
    const sortProductsBySaleDate = (products: Product[]): Product[] => {
      return products
        .filter(p => p.is_active && p.price > 0)  // 가격이 있는 활성 상품만 필터링
        .sort((a, b) => {
          // 상시 판매 상품은 마지막에 배치
          if (!a.sale_date || a.sale_date.trim() === '') return 1;
          if (!b.sale_date || b.sale_date.trim() === '') return -1;
          
          // 판매일 역순 (최신 날짜가 먼저)
          const dateA = new Date(a.sale_date);
          const dateB = new Date(b.sale_date);
          const dateComparison = dateB.getTime() - dateA.getTime();
          
          if (dateComparison !== 0) {
            return dateComparison;
          }
          
          // 같은 판매일인 경우 가나다순
          return a.name.localeCompare(b.name, 'ko-KR')
        })
    }

    // 헤더 행 생성 (4줄 구조) - 구글시트 API와 완전히 동일
    const createHeaderRows = (products: Product[]): string[][] => {
      const sortedProducts = sortProductsBySaleDate(products)
      
      // 첫번째 줄: 상품명
      const productNames = sortedProducts.map(p => p.name.replace(/\n/g, ' '))
      const firstRow = ['주문자', '원본주문', '비고', ...productNames]
      
      // 두번째 줄: 판매일
      const saleDates = sortedProducts.map(p => {
        // sale_date가 없거나 빈 문자열이면 '상시'로 표시
        if (!p.sale_date || p.sale_date.trim() === '') {
          return '상시'
        }
        return p.sale_date
      })
      const secondRow = ['', '', '', ...saleDates]
      
      // 세번째 줄: 판매가 (3A 셀에 "판매가" 제목 추가)
      const prices = sortedProducts.map(p => p.price || 0)
      const thirdRow = ['판매가', '', '', ...prices]
      
      // 네번째 줄: 재고 (4A 셀에 "재고" 제목 추가)
      const fourthRow = ['재고', '', '', ...new Array(productNames.length).fill('')]
      
      return [firstRow, secondRow, thirdRow, fourthRow]
    }

    // 주문 데이터 포맷팅 - 구글시트 API와 완전히 동일
    const formatOrderData = (orders: OrderData[], products: Product[]): string[][] => {
      const sortedProducts = sortProductsBySaleDate(products)
      const rows: string[][] = []
      
      // 닉네임별로 그룹화
      const groupedOrders = orders.reduce((acc, order) => {
        if (!acc[order.nickname]) {
          acc[order.nickname] = []
        }
        acc[order.nickname].push(order)
        return acc
      }, {} as Record<string, OrderData[]>)

      Object.entries(groupedOrders).forEach(([nickname, orderList]) => {
        orderList.forEach((order, index) => {
          const row: string[] = []
          
          // 첫 번째 행이면 닉네임 표시, 아니면 빈 문자열
          if (index === 0) {
            row.push(nickname)
          } else {
            row.push('')
          }
          
          // 원본주문 (줄바꿈을 유지하면서 정리) - 구글시트 API와 완전히 동일
          if (!order.orderText || order.orderText.trim() === '') {
            row.push('')
          } else {
            const processedOrderText = order.orderText
              .replace(/\r\n/g, '\n')
              .replace(/\r/g, '\n')
              .split('\n')
              .map(line => line.trim())
              .filter(line => line.length > 0)
              .join('\n')
              .replace(/\n\s+/g, '\n')
              .replace(/\s+\n/g, '\n')
              .trim();

            // 여러 상품이 한 줄에 있을 때 분리
            const productPattern = /(\d+개)(?=\s|$)/g;
            const parts = processedOrderText.split(productPattern);
            
            let finalOrderText;
            if (parts.length > 1) {
              const products = [];
              for (let i = 0; i < parts.length; i += 2) {
                if (parts[i] && parts[i + 1]) {
                  const product = (parts[i] + parts[i + 1]).trim();
                  if (product) {
                    products.push(product);
                  }
                }
              }
              
              if (products.length > 1) {
                finalOrderText = products.join('\n');
              } else {
                finalOrderText = processedOrderText;
              }
            } else {
              finalOrderText = processedOrderText;
            }
            
            // Google Sheets에서 줄바꿈을 표시하기 위해 \n을 구글시트 수식으로 변환
            if (finalOrderText.includes('\n')) {
              const lines = finalOrderText.split('\n')
              if (lines.length > 1) {
                const firstLine = lines[0]
                const remainingLines = lines.slice(1).join('CHAR(10)')
                finalOrderText = `="${firstLine}"&CHAR(10)&"${remainingLines}"`
              }
            }
            row.push(finalOrderText)
          }
          
          row.push(order.notes || '') // 비고 추가
          
          // 상품별 주문 수량 처리
          sortedProducts.forEach(product => {
            const matchingOrder = order.products.find(p => p.name === product.name)
            if (matchingOrder && matchingOrder.quantity > 0) {
              row.push(matchingOrder.quantity.toString())
            } else {
              row.push('')
            }
          })
          
          rows.push(row)
        })
      })
      
      return rows
    }

    // 헤더 행들 생성 (4줄) - 구글시트 API와 동일
    const headerRows = createHeaderRows(products)
    
    // 주문 데이터 포맷팅 - 구글시트 API와 동일
    console.log('API에서 받은 주문 데이터:', orders);
    const orderRows = formatOrderData(orders, products)
    console.log('포맷팅된 주문 행:', orderRows);
    
    // 총 주문수 라인 생성 (수식으로 계산) - 구글시트 API와 완전히 동일
    const productColumns = headerRows[0].length - 3 // 헤더에서 주문자, 원본주문, 비고 제외
    const headerRowCount = headerRows.length // 헤더 행 수 (4)
    const dataStartRow = headerRowCount + 2 // 데이터 시작 행 (6행) - 첫 번째 총주문수 행 다음
    const dataEndRow = dataStartRow + orderRows.length - 1 // 주문 데이터 끝 행 (총주문수 라인 제외)
    
    console.log(`행 번호 계산: headerRowCount=${headerRowCount}, dataStartRow=${dataStartRow}, dataEndRow=${dataEndRow}, orderRows.length=${orderRows.length}`);
    
    // 각 상품별 총 주문수 계산 수식 (구글시트 API와 동일)
    const totalOrderFormulas = [];
    for (let i = 0; i < productColumns; i++) {
      const columnLetter = getColumnLetter(4 + i); // D=4, E=5, F=6, ... (주문자, 원본주문, 비고 제외)
      const formula = `=SUM(${columnLetter}${dataStartRow}:${columnLetter}${dataEndRow})`;
      totalOrderFormulas.push(formula);
    }
    const totalOrderRow = ['총 주문수', '', '', ...totalOrderFormulas]
    
    // 총 판매액 라인 생성 (판매가 × 주문수) - 구글시트 API와 완전히 동일
    const totalSalesFormulas = [];
    for (let i = 0; i < productColumns; i++) {
      const columnLetter = getColumnLetter(4 + i); // D=4, E=5, F=6, ...
      const priceRow = 3; // 판매가가 있는 행 (1-based)
      const totalOrderRowNum = headerRows.length + 1; // 총 주문수 행 (1-based)
      const formula = `=${columnLetter}${priceRow}*${columnLetter}${totalOrderRowNum}`;
      totalSalesFormulas.push(formula);
    }
    
    const totalSalesDataRow = ['총 판매액', '', '', ...totalSalesFormulas]
    
    // 실제 주문 데이터에서 상품별 주문수량을 계산하여 컬럼 정렬 - 구글시트 API와 완전히 동일
    const sortColumnsByOrderQuantity = (data: string[][], orders: OrderData[]) => {
      // 상품별 주문수량 계산 - orderRows에서 직접 계산
      const productOrderCounts = new Map<string, number>()
      
      // orderRows에서 각 상품의 주문수량 계산
      const headerRowCount = headerRows.length
      const orderDataStartRow = headerRowCount + 1 // 주문 데이터 시작 행
      const orderDataEndRow = data.length - 2 // 총 판매액 행 제외
      
      console.log(`주문 데이터 행 범위: ${orderDataStartRow} ~ ${orderDataEndRow}`)
      
      for (let rowIndex = orderDataStartRow; rowIndex < orderDataEndRow; rowIndex++) {
        const row = data[rowIndex]
        if (row && row.length > 3) { // 주문자, 원본주문, 비고, 상품들
          for (let colIndex = 3; colIndex < row.length - 1; colIndex++) { // 상품 컬럼들 (비고 제외)
            const quantity = row[colIndex]
            if (quantity && quantity !== '' && quantity !== '0' && !isNaN(Number(quantity))) {
              const productName = data[0][colIndex]
              const currentCount = productOrderCounts.get(productName) || 0
              productOrderCounts.set(productName, currentCount + Number(quantity))
            }
          }
        }
      }

      // 상품별 총 주문 수량을 기준으로 정렬
      const productTotals: { index: number; total: number; name: string }[] = []
      for (let i = 3; i < data[0].length - 1; i++) { // 상품 컬럼들
        const productName = data[0][i]
        const orderCount = productOrderCounts.get(productName) || 0
        productTotals.push({ index: i, total: orderCount, name: productName })
      }

      // 주문 수량 내림차순, 같으면 가나다순으로 정렬
      productTotals.sort((a, b) => {
        if (a.total !== b.total) {
          return b.total - a.total
        }
        return a.name.localeCompare(b.name, 'ko-KR')
      })

      // 정렬된 순서로 데이터 재구성
      const reorderedData = data.map(row => {
        const newRow = [...row.slice(0, 3)] // 주문자, 원본주문, 비고는 그대로
        productTotals.forEach(({ index }) => {
          newRow.push(row[index]) // 상품 컬럼들 추가
        })
        newRow.push(row[row.length - 1]) // 마지막 비고 컬럼 추가
        return newRow
      })
      
      return reorderedData
    }
    
    // 모든 데이터를 스프레드시트에 작성 (헤더 + 총주문수 + 주문데이터 + 총주문수 + 총판매액) - 구글시트 API와 완전히 동일
    const allData = [...headerRows, totalOrderRow, ...orderRows, totalOrderRow, totalSalesDataRow]
    
    // 주문수량 기준으로 컬럼 정렬 - 구글시트 API와 동일
    const sortedAllData = sortColumnsByOrderQuantity(allData, orders)
    
    // 정렬 후 수식 재생성 - 구글시트 API와 완전히 동일
    const regenerateFormulas = (data: string[][]) => {
      const headerRowCount = headerRows.length
      const totalOrderRowIndex = headerRowCount
      const totalSalesRowIndex = data.length - 1
      
      // 행 번호 재계산 (구글시트 API와 동일)
      const recalculatedDataStartRow = headerRowCount + 2 // 데이터 시작 행 (6행)
      // 주문 데이터 행 수 계산: 전체 데이터 - 헤더(4) - 첫번째총주문수(1) - 마지막총주문수(1) - 총판매액(1)
      const orderDataRowCount = data.length - headerRowCount - 3
      const recalculatedDataEndRow = recalculatedDataStartRow + orderDataRowCount - 1 // 주문 데이터 끝 행
      
      // 총 주문수 행의 수식 재생성 (첫 번째 총주문수 행)
      for (let i = 3; i < data[totalOrderRowIndex].length - 1; i++) {
        const columnLetter = getColumnLetter(i + 1) // A=1, B=2, C=3, D=4, E=5, ...
        const formula = `=SUM(${columnLetter}${recalculatedDataStartRow}:${columnLetter}${recalculatedDataEndRow})`
        data[totalOrderRowIndex][i] = formula
      }
      
      // 총 주문수 행의 수식 재생성 (마지막 총주문수 행)
      const lastTotalOrderRowIndex = data.length - 2
      for (let i = 3; i < data[lastTotalOrderRowIndex].length - 1; i++) {
        const columnLetter = getColumnLetter(i + 1) // A=1, B=2, C=3, D=4, E=5, ...
        const formula = `=SUM(${columnLetter}${recalculatedDataStartRow}:${columnLetter}${recalculatedDataEndRow})`
        data[lastTotalOrderRowIndex][i] = formula
      }
      
      // 총 판매액 행의 수식 재생성
      const salesFormulas = [];
      for (let i = 3; i < data[totalSalesRowIndex].length - 1; i++) {
        const columnLetter = getColumnLetter(i + 1) // A=1, B=2, C=3, D=4, E=5, ...
        const priceRow = 3 // 판매가가 있는 행 (1-based)
        const totalOrderRowNum = totalOrderRowIndex + 1 // 1-based 행 번호
        const formula = `=${columnLetter}${priceRow}*${columnLetter}${totalOrderRowNum}`
        data[totalSalesRowIndex][i] = formula
        salesFormulas.push(formula)
      }
      
      // 총 판매액 합계는 제거 (원래 상태로 복원)
      
      return data
    }
    
    // 수식 재생성 - 구글시트 API와 동일
    const finalData = regenerateFormulas(sortedAllData)
    
    // 최종 데이터 확인
    console.log('=== 최종 데이터 확인 ===');
    console.log('총 행 수:', finalData.length);
    console.log('첫 번째 총주문수 행:', finalData[headerRows.length]);
    console.log('마지막 총주문수 행:', finalData[finalData.length - 2]);
    console.log('총 판매액 행:', finalData[finalData.length - 1]);

    // 업로드된 엑셀 파일 읽기
    const uploadedExcelBuffer = await excelFile.arrayBuffer();
    const workbook = XLSX.read(uploadedExcelBuffer, { type: 'array' });

    // 구글시트 데이터를 엑셀 워크시트로 변환 (finalData 사용)
    const googleWorksheet = XLSX.utils.aoa_to_sheet(finalData);
    
    // 수식과 숫자 셀들을 올바르게 설정
    const range = XLSX.utils.decode_range(googleWorksheet['!ref'] || 'A1');
    for (let row = 0; row <= range.e.r; row++) {
      for (let col = 0; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = googleWorksheet[cellAddress];
        
        if (cell && typeof cell.v === 'string') {
          if (cell.v.startsWith('=')) {
            // 수식인 경우 f 속성에 수식 저장
            const formula = cell.v.trim();
            if (formula && formula.length > 1) {
              cell.f = formula;
              delete cell.v; // v 속성 제거하여 수식으로 인식되도록 함
              console.log(`수식 설정: ${cellAddress} = ${cell.f}`);
            }
          } else if (cell.v.match(/^\d+$/)) {
            // 숫자만 있는 경우 숫자로 변환
            cell.v = parseInt(cell.v, 10);
            cell.t = 'n'; // 숫자 타입으로 설정
          }
        }
      }
    }
    
    // 컬럼 너비 설정 (finalData에 맞게)
    const finalProductColumns = finalData[0].length - 3; // 주문자, 원본주문, 비고 제외
    const colWidths = [
      { wch: 15 }, // 주문자
      { wch: 80 }, // 원본주문 (더 넓게 설정)
      { wch: 20 }, // 비고
      ...Array(finalProductColumns).fill({ wch: 15 }) // 상품 컬럼들
    ];
    googleWorksheet['!cols'] = colWidths;
    
    // 원본주문 컬럼(B열)에 줄바꿈 설정
    for (let row = 1; row <= range.e.r + 1; row++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row - 1, c: 1 }); // B열 (인덱스 1)
      if (googleWorksheet[cellAddress]) {
        googleWorksheet[cellAddress].s = {
          ...googleWorksheet[cellAddress].s,
          alignment: {
            ...googleWorksheet[cellAddress].s?.alignment,
            wrapText: true,
            vertical: 'top'
          }
        };
      }
    }
    
    // 첫 5열 고정 (A~E열)
    googleWorksheet['!freeze'] = { xSplit: 5, ySplit: 0 };

    // 새 워크북 생성
    const newWorkbook = XLSX.utils.book_new()
    
    // 구글시트 데이터를 첫 번째 탭으로 추가 (중복 시트명 처리)
    let finalGoogleSheetName = googleSheetName;
    let counter = 1;
    while (newWorkbook.SheetNames.includes(finalGoogleSheetName)) {
      finalGoogleSheetName = `${googleSheetName}(${counter})`;
      counter++;
    }
    
    XLSX.utils.book_append_sheet(newWorkbook, googleWorksheet, finalGoogleSheetName)
    
    // 기존 엑셀 파일의 시트들을 새 워크북에 복사
    workbook.SheetNames.forEach((sheetName: string) => {
      const worksheet = workbook.Sheets[sheetName]
      let finalSheetName = sheetName
      let counter = 1
      const originalSheetName = sheetName
      
      // 중복 시트명 방지
      while (newWorkbook.SheetNames.includes(finalSheetName)) {
        finalSheetName = `${originalSheetName}(${counter})`
        counter++
      }
      
      XLSX.utils.book_append_sheet(newWorkbook, worksheet, finalSheetName)
    })

    // 엑셀 파일 생성 (안전한 옵션 사용)
    const finalExcelBuffer = XLSX.write(newWorkbook, { 
      bookType: 'xlsx', 
      type: 'array',
      compression: false, // 압축 비활성화로 안정성 향상
      cellStyles: false, // 셀 스타일 비활성화
      cellNF: false, // 숫자 포맷 비활성화
      cellHTML: false // HTML 변환 비활성화
    })
    
    // 파일명 생성
    const fileName = `${date || '주문내역'}.xlsx`
    
    return new NextResponse(finalExcelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
      }
    })

  } catch (error) {
    console.error('엑셀 파일 생성 실패:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { 
        error: '엑셀 파일 생성에 실패했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}