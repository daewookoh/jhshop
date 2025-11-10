import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface SendEmailRequest {
  productName: string;
  productPrice: number;
  quantity: number;
  productTotal: number;
  shippingFee: number;
  totalPrice: number;
  paymentStatus: string;
  ordererName: string;
  ordererMobile: string;
  recipientName: string;
  recipientMobile: string;
  address: string;
  addressDetail?: string;
  postcode?: string;
  orderDate: string;
  recipientEmail?: string; // 받는 사람 이메일 (선택사항)
}

export async function POST(request: NextRequest) {
  try {
    // 환경변수 확인
    const gmailUser = "bdkfasd@gmail.com";
    const gmailAppPassword = "dtie wvnp quba tlid";
    const recipientEmail = "verbaljint3@naver.com"; // 기본 받는 사람 이메일

    if (!gmailUser || !gmailAppPassword) {
      console.error('Gmail 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: '이메일 설정이 완료되지 않았습니다. 환경변수를 확인해주세요.' },
        { status: 500 }
      );
    }

    if (!recipientEmail) {
      console.error('ORDER_EMAIL_RECIPIENT 환경변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: '받는 사람 이메일이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const body: SendEmailRequest = await request.json();
    const {
      productName,
      productPrice,
      quantity,
      productTotal,
      shippingFee,
      totalPrice,
      paymentStatus,
      ordererName,
      ordererMobile,
      recipientName,
      recipientMobile,
      address,
      addressDetail,
      postcode,
      orderDate,
      recipientEmail: customRecipientEmail,
    } = body;

    if (!productName || !quantity) {
      return NextResponse.json(
        { error: '상품명과 수량이 필요합니다.' },
        { status: 400 }
      );
    }

    // Gmail SMTP 설정
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });

    // 이메일 제목: [주문] 상품명 (수량)
    const subject = `[주문] ${productName} (${quantity}개)`;

    // 주소 포맷팅
    const formattedAddress = postcode
      ? `[${postcode}] ${address}${addressDetail ? ` ${addressDetail}` : ''}`
      : `${address}${addressDetail ? ` ${addressDetail}` : ''}`;

    // 휴대폰 번호 포맷팅 (010-1234-5678)
    const formatPhone = (phone: string) => {
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length === 11 && cleaned.startsWith('010')) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
      }
      return phone;
    };

    // 이메일 본문 (상세한 주문 내역)
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">
          새로운 주문이 접수되었습니다
        </h2>
        
        <div style="margin-top: 30px;">
          <h3 style="color: #555; margin-bottom: 15px;">주문 정보</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold; width: 150px;">상품명</td>
              <td style="padding: 8px;">${productName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold;">상품 단가</td>
              <td style="padding: 8px;">${productPrice.toLocaleString()}원</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold;">수량</td>
              <td style="padding: 8px;">${quantity}개</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold;">상품금액</td>
              <td style="padding: 8px;">${productTotal.toLocaleString()}원</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold;">배송비</td>
              <td style="padding: 8px;">${shippingFee.toLocaleString()}원</td>
            </tr>
            <tr style="border-top: 2px solid #333;">
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold; font-size: 16px;">총 결제금액</td>
              <td style="padding: 8px; font-size: 18px; font-weight: bold; color: #d32f2f;">${totalPrice.toLocaleString()}원</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold;">결제상태</td>
              <td style="padding: 8px;">${paymentStatus}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 30px;">
          <h3 style="color: #555; margin-bottom: 15px;">주문자 정보</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold; width: 150px;">이름</td>
              <td style="padding: 8px;">${ordererName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold;">휴대폰</td>
              <td style="padding: 8px;">${formatPhone(ordererMobile)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 30px;">
          <h3 style="color: #555; margin-bottom: 15px;">배송 정보</h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold; width: 150px;">받는분 이름</td>
              <td style="padding: 8px;">${recipientName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold;">받는분 휴대폰</td>
              <td style="padding: 8px;">${formatPhone(recipientMobile)}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f5f5f5; font-weight: bold; vertical-align: top;">주소</td>
              <td style="padding: 8px; white-space: pre-line;">${formattedAddress}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top: 30px;">
          <h3 style="color: #555; margin-bottom: 15px;">주문 일시</h3>
          <p style="margin: 0; padding: 8px; background-color: #f5f5f5;">${orderDate}</p>
        </div>

        <p style="margin-top: 30px; color: #666; font-size: 12px; text-align: center; border-top: 1px solid #ddd; padding-top: 20px;">
          이 이메일은 자동으로 발송되었습니다.
        </p>
      </div>
    `;

    const textContent = `
새로운 주문이 접수되었습니다

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
주문 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
상품명: ${productName}
상품 단가: ${productPrice.toLocaleString()}원
수량: ${quantity}개
상품금액: ${productTotal.toLocaleString()}원
배송비: ${shippingFee.toLocaleString()}원
총 결제금액: ${totalPrice.toLocaleString()}원
결제상태: ${paymentStatus}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
주문자 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이름: ${ordererName}
휴대폰: ${formatPhone(ordererMobile)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
배송 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
받는분 이름: ${recipientName}
받는분 휴대폰: ${formatPhone(recipientMobile)}
주소: ${formattedAddress}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
주문 일시
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${orderDate}
    `.trim();

    // 이메일 발송
    const mailOptions = {
      from: gmailUser,
      to: customRecipientEmail || recipientEmail,
      subject: subject,
      text: textContent,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({
      success: true,
      message: '이메일이 성공적으로 발송되었습니다.',
    });
  } catch (error) {
    console.error('이메일 발송 실패:', error);
    return NextResponse.json(
      {
        error: '이메일 발송 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

