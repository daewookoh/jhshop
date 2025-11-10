import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface SendEmailRequest {
  productName: string;
  quantity: number;
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
    const { productName, quantity, recipientEmail: customRecipientEmail } = body;

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

    // 이메일 본문 (간단한 형식)
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #333;">새로운 주문이 접수되었습니다</h2>
        <div style="margin-top: 20px;">
          <p><strong>상품명:</strong> ${productName}</p>
          <p><strong>수량:</strong> ${quantity}개</p>
        </div>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">
          이 이메일은 자동으로 발송되었습니다.
        </p>
      </div>
    `;

    const textContent = `
새로운 주문이 접수되었습니다

상품명: ${productName}
수량: ${quantity}개
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

