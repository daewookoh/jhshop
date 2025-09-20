import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

interface OrderData {
  nickname: string
  orderText: string
  notes?: string
  products?: string[]
}

interface Product {
  id: string
  name: string
  is_active: boolean
  sale_date?: string
}

interface RequestPayload {
  date?: string
  orders?: OrderData[]
  products?: Product[]
}

// Google Sheets API 설정
const SPREADSHEET_ID = '14f29cGpEAITHa8gb60JcyXMONPj0KCt7FKKuj1gYrm8'
const CLIENT_EMAIL = 'admin-59@jaehyung-shop.iam.gserviceaccount.com'
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDSHxw4VRXFO00c
f/lhOrTD9ftV6wn8L4p2wokuiylBu6vWWlAUIBcIZi5nlozEyawfT2X/fdTag49F
/ehoqHfkospV38wUUVgk1n7kjAePBlDZsCXkpnHFuveHd3clzbaV8KIAoR7JBNR3
mmyGPbEepBgKmS4amUuw3eobjHO95J4HAy/orZz4LFh17+jWCGSMFN/P8STgHdfG
AS1dRiFQJUbeTxOFNy4yfOB0M8OZu/SbaoyQd1p8p+kzbb4/g6cGOWpceAXCXCFM
pYSy2WlL6qMus9vfxmthJlJHrOU58KH67Z6DzWR0RpP0gTsel6LkmjdCFbWvappY
vKFnSUTNAgMBAAECggEABNdeqRWcyMyS/EMeldTqcVFrlxExS7Q0toPI8V+XdcJD
NU8jZTNQFIt2KkDXwXj8FESaDwbxLo+1b2FoR3EKQiRWESB07Urqgv7GMbHgQrVc
i4d5eAk1ud6S8XYZMq/Isy+2K9mKggswcgkG0xj8yb3yJ9xbqZU6nzqduEDGMevV
4DrWP+JOprp90Zbtr2kwji07G+vr/h5UPiR76ILWxmqpIjAVqlXuAabeQJVjuRM9
z6lC7VsHLRJDUD7aqYXOqkUrvECo7RRlf//wkl9rsRsRnTKTUOuquriehmqh7/gr
42UeHAmJxkxUPOa2oH6xuBL1F41Jd6ibH39taKUIQQKBgQDolHG6pF0R6hGSEYSa
98UZIbzXYHEc5971ufUzbJb5GOSbOGZbMmEd2Pxh4nADyRW2St93if3mn6euDj+/
czb89oS6VEnGFaR2rd5YvFkebqptwrsIKbnVN3XuE4Q9qpo7FOzjqQAF/+e0sQUJ
BzoPZ4/FuMXqaA58gNMFhjdNNQKBgQDnR7ljLHwxXUD/V78tmUhi6zpQzT+fMHoo
1VU1G/V3WJPR0cgxo/F4hBOrFLUd/530lTF3l0Qgxgn/uKXfihnFg1uCsaZrdZA8
Wrgn107G4CxroNXQvrLKp0Gkc7VPTIWOpLr3A4z6HeOyovFBe9ifkJejof/wapxo
a/56THtEOQKBgQDbdbca9p0bmlKaEg2ebM1+uWcHk+kn7WNlWuMUcxLCWcrc7Iso
4pDhKS587r3j1Iq4SE407fC2/U+r3aYpcP4iFDuJ1p8GWsWldsqn0JIHNUV77JOv
UDAaEQsmayQNTD3cIhKlf4KWJrLsvVyS+E7A2me/mmqmlSmWMbjtLYhhQQKBgEgR
u51B0Xl4e7aV20cUStA4SLXBH6A1dPugbqrcCYOlIHrzihSd57MMRSy8iSvN6aS7
kOyZQGuOCrObEGU2HY3EvxFc1mUJ/2YvRs9zcmLanDz1o2sm4YPw1q2uOMN7Lusi
PfiXLKkMA1Y5HECxnPEsF3SwGJcMQazwah4mEwtRAoGAMjXAYnNmBJiFdHIziow4
RyzgBWDV0uP+p7y6+YwkMQOtTgdhrGjRIuEI52BAYLnmdsHZPH2krrai81dRv+C/
Bmd0XuVxn9+kbfSdVWsM5ssuokjcg2Ix437TnQLEyY+qDR92PkyCIkOTJElRc752
apg0saGugDRBQhJMWDW0giY=
-----END PRIVATE KEY-----`

// Google Sheets API 클라이언트 생성
const auth = new google.auth.JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

export async function GET() {
  try {
    // 시트 목록 가져오기
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    })
    const sheetList = response.data.sheets?.map(sheet => sheet.properties?.title || '') || []
    
    const data = {
      sheets: sheetList,
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Google Sheets API Error:', error)
    
    // 권한 오류에 대한 더 자세한 메시지
    if (error instanceof Error) {
      if (error.message.includes('permission') || error.message.includes('403')) {
        return NextResponse.json(
          { 
            error: 'Google Sheets 접근 권한이 없습니다. 서비스 계정이 스프레드시트에 공유되어 있는지 확인해주세요.',
            details: `서비스 계정: ${CLIENT_EMAIL}`,
            spreadsheetId: SPREADSHEET_ID
          },
          { status: 403 }
        )
      }
      
      if (error.message.includes('not found') || error.message.includes('404')) {
        return NextResponse.json(
          { 
            error: '스프레드시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요.',
            spreadsheetId: SPREADSHEET_ID
          },
          { status: 404 }
        )
      }
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Google Sheets API 호출 중 오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { date, orders, products }: RequestPayload = await request.json()
    
    if (!date || !orders || !products) {
      return NextResponse.json(
        { error: 'Missing required fields: date, orders, products' },
        { status: 400 }
      )
    }
    
    // 새 시트 생성
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    })
    const existingSheets = response.data.sheets?.map(sheet => sheet.properties?.title || '') || []
    
    let sheetName = date
    let counter = 1
    while (existingSheets.includes(sheetName)) {
      sheetName = `${date}(${counter})`
      counter++
    }
    
    const addSheetResponse = await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetName
            }
          }
        }]
      }
    })
    
    // 새로 생성된 시트의 ID 가져오기
    const newSheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId || 0
    
    // 상품 목록을 판매일 역순, 상시는 마지막, 같은 판매일은 가나다순으로 정렬
    const sortProductsBySaleDate = (products: Product[]): Product[] => {
      return products
        .filter(p => p.is_active)
        .sort((a, b) => {
          // sale_date가 없거나 빈 문자열이거나 유효하지 않은 날짜인 경우 상시로 처리
          const isValidDate = (dateStr: string | undefined) => {
            if (!dateStr || dateStr.trim() === '') return false
            const date = new Date(dateStr)
            return !isNaN(date.getTime())
          }
          
          const aIsValid = isValidDate(a.sale_date)
          const bIsValid = isValidDate(b.sale_date)
          
          // 상시 상품(sale_date가 유효하지 않은 경우)은 맨 마지막
          if (!aIsValid && !bIsValid) {
            return a.name.localeCompare(b.name, 'ko-KR')
          }
          if (!aIsValid) return 1
          if (!bIsValid) return -1
          
          // 판매일이 있는 경우 판매일 역순으로 정렬
          const dateA = new Date(a.sale_date!)
          const dateB = new Date(b.sale_date!)
          
          if (dateA.getTime() !== dateB.getTime()) {
            return dateB.getTime() - dateA.getTime() // 역순
          }
          
          // 같은 판매일인 경우 가나다순
          return a.name.localeCompare(b.name, 'ko-KR')
        })
    }
    
    // 헤더 행 생성 (3줄 구조)
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
      
      // 세번째 줄: 재고 (3A 셀에 "재고" 제목 추가)
      const thirdRow = ['재고', '', '', ...new Array(productNames.length).fill('')]
      
      return [firstRow, secondRow, thirdRow]
    }
    
    // 주문 데이터를 스프레드시트 형식으로 변환
    const formatOrderData = (orders: OrderData[], products: Product[]): string[][] => {
      const sortedProducts = sortProductsBySaleDate(products)
      
      // 닉네임별로 그룹화
      const groupedOrders = orders.reduce((acc, order) => {
        if (!acc[order.nickname]) {
          acc[order.nickname] = []
        }
        acc[order.nickname].push(order)
        return acc
      }, {} as Record<string, OrderData[]>)
      
      const rows: string[][] = []
      
      Object.entries(groupedOrders).forEach(([nickname, orderList]) => {
        orderList.forEach((order, index) => {
          const row: string[] = []
          
          // 첫 번째 행이면 닉네임 표시, 아니면 빈 문자열
          if (index === 0) {
            row.push(nickname)
          } else {
            row.push('')
          }
          
          // 원본주문
          row.push(order.orderText)
          
          // 비고
          row.push(order.notes || '')
          
          // 상품별 주문 수량 (현재는 빈 문자열로 설정)
          sortedProducts.forEach(() => {
            row.push('')
          })
          
          rows.push(row)
        })
      })
      
      return rows
    }
    
    // 헤더 행들 생성 (3줄)
    const headerRows = createHeaderRows(products)
    
    // 주문 데이터 포맷팅
    const orderRows = formatOrderData(orders, products)
    
    // 모든 데이터를 스프레드시트에 작성
    const allData = [...headerRows, ...orderRows]
    
    // 데이터 작성
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: allData
      }
    })
    
    // 셀 서식 설정
    const formatRequests = []
    
    // 1. 모든 셀의 텍스트 줄바꿈 설정
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId: newSheetId,
          startRowIndex: 0,
          endRowIndex: allData.length,
          startColumnIndex: 0,
          endColumnIndex: allData[0].length
        },
        cell: {
          userEnteredFormat: {
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat.wrapStrategy'
      }
    })
    
    // 2. 첫 번째 줄(상품명 헤더) 가운데 정렬
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId: newSheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: allData[0].length
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              bold: true
            }
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.textFormat.bold'
      }
    })
    
    // 3. 두 번째 줄(판매일 헤더) 가운데 정렬
    formatRequests.push({
      repeatCell: {
        range: {
          sheetId: newSheetId,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: allData[0].length
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: {
              bold: true
            }
          }
        },
        fields: 'userEnteredFormat.horizontalAlignment,userEnteredFormat.verticalAlignment,userEnteredFormat.textFormat.bold'
      }
    })
    
    // 3. 원본주문 컬럼(두 번째 컬럼)의 너비를 넓게 설정
    formatRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId: newSheetId,
          dimension: 'COLUMNS',
          startIndex: 1, // B열 (원본주문)
          endIndex: 2
        },
        properties: {
          pixelSize: 300 // 원본주문 컬럼을 300px로 설정
        },
        fields: 'pixelSize'
      }
    })
    
    // 4. 주문자 컬럼(첫 번째 컬럼)의 너비 설정
    formatRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId: newSheetId,
          dimension: 'COLUMNS',
          startIndex: 0, // A열 (주문자)
          endIndex: 1
        },
        properties: {
          pixelSize: 120 // 주문자 컬럼을 120px로 설정
        },
        fields: 'pixelSize'
      }
    })
    
    // 5. 비고 컬럼(세 번째 컬럼)의 너비 설정
    formatRequests.push({
      updateDimensionProperties: {
        range: {
          sheetId: newSheetId,
          dimension: 'COLUMNS',
          startIndex: 2, // C열 (비고)
          endIndex: 3
        },
        properties: {
          pixelSize: 150 // 비고 컬럼을 150px로 설정
        },
        fields: 'pixelSize'
      }
    })
    
    // 6. 상품 컬럼들의 너비를 텍스트 길이에 맞춰 동적 설정
    const productColumns = allData[0].length - 3 // 헤더에서 주문자, 원본주문, 비고 제외
    const sortedProducts = sortProductsBySaleDate(products)
    
    for (let i = 0; i < productColumns; i++) {
      const productName = sortedProducts[i]?.name || ''
      // 한글 텍스트 길이를 고려한 너비 계산 (한글 1자당 약 14px, 영문 1자당 약 8px)
      const textLength = productName.length
      const koreanChars = (productName.match(/[가-힣]/g) || []).length
      const otherChars = textLength - koreanChars
      const calculatedWidth = Math.max(80, (koreanChars * 14) + (otherChars * 8) + 20) // 최소 80px, 여백 20px
      
      formatRequests.push({
        updateDimensionProperties: {
          range: {
            sheetId: newSheetId,
            dimension: 'COLUMNS',
            startIndex: 3 + i, // 상품 컬럼들
            endIndex: 4 + i
          },
          properties: {
            pixelSize: Math.min(calculatedWidth, 300) // 최대 300px로 제한
          },
          fields: 'pixelSize'
        }
      })
    }
    
    // 7. 모든 행의 높이를 자동 조정
    formatRequests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId: newSheetId,
          dimension: 'ROWS'
        }
      }
    })
    
    // 8. 모든 컬럼의 너비를 자동 조정 (동적 너비 설정 후에는 제거)
    // formatRequests.push({
    //   autoResizeDimensions: {
    //     dimensions: {
    //       sheetId: newSheetId,
    //       dimension: 'COLUMNS'
    //     }
    //   }
    // })
    
    // 서식 적용
    if (formatRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: formatRequests
        }
      })
    }
    
    // 셀 병합 (같은 닉네임의 첫 번째 칸)
    const mergeRequests = []
    let currentNickname = ''
    let startRow = 4 // 헤더 3줄 다음부터 시작
    
    orderRows.forEach((row, index) => {
      const nickname = row[0]
      const actualRow = index + 4 // 실제 행 번호 (헤더 3줄 포함)
      
      if (nickname && nickname !== currentNickname) {
        // 이전 닉네임의 셀 병합
        if (currentNickname && actualRow > startRow) {
          mergeRequests.push({
            mergeCells: {
              range: {
                sheetId: newSheetId,
                startRowIndex: startRow - 1,
                endRowIndex: actualRow - 1,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              mergeType: 'MERGE_ROWS'
            }
          })
        }
        
        currentNickname = nickname
        startRow = actualRow
      }
    })
    
    // 마지막 닉네임의 셀 병합
    if (currentNickname && orderRows.length > 0) {
      const lastRow = orderRows.length + 4 // 헤더 3줄 + 데이터
      if (lastRow > startRow) {
        mergeRequests.push({
          mergeCells: {
            range: {
              sheetId: newSheetId,
              startRowIndex: startRow - 1,
              endRowIndex: lastRow,
              startColumnIndex: 0,
              endColumnIndex: 1
            },
            mergeType: 'MERGE_ROWS'
          }
        })
      }
    }
    
    // 셀 병합 실행
    if (mergeRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: mergeRequests
        }
      })
    }
    
    const data = {
      success: true,
      sheetName,
      message: '주문 데이터가 성공적으로 작성되었습니다.'
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Google Sheets API Error:', error)
    
    // 권한 오류에 대한 더 자세한 메시지
    if (error instanceof Error) {
      if (error.message.includes('permission') || error.message.includes('403')) {
        return NextResponse.json(
          { 
            error: 'Google Sheets 접근 권한이 없습니다. 서비스 계정이 스프레드시트에 공유되어 있는지 확인해주세요.',
            details: `서비스 계정: ${CLIENT_EMAIL}`,
            spreadsheetId: SPREADSHEET_ID
          },
          { status: 403 }
        )
      }
      
      if (error.message.includes('not found') || error.message.includes('404')) {
        return NextResponse.json(
          { 
            error: '스프레드시트를 찾을 수 없습니다. 스프레드시트 ID를 확인해주세요.',
            spreadsheetId: SPREADSHEET_ID
          },
          { status: 404 }
        )
      }
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Google Sheets API 호출 중 오류가 발생했습니다.'
      },
      { status: 500 }
    )
  }
}
