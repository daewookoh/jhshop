# Jaehyeong Magic Shop - 주문 관리 시스템

## 프로젝트 개요

이 프로젝트는 마법 상점의 주문 관리 시스템입니다. 상품 등록, 주문 내역 관리, 그리고 카카오톡 대화 파일을 통한 주문 내역 자동 업로드 기능을 제공합니다.

## 주요 기능

### 1. 상품 관리
- 상품 등록, 수정, 삭제
- 상품 이미지 업로드 및 자동 편집
- 날짜별/상시 상품 구분
- 상품 활성화/비활성화

### 2. 주문 내역 관리
- 날짜별 주문 내역 조회
- 주문자별 주문 내역 그룹화
- 주문 내역 검색 및 정렬

### 3. 카카오톡 주문 내역 업로드 (NEW!)
- 카카오톡 대화 파일(.txt) 업로드
- 6자리 날짜 형식(YYMMDD) 입력
- AI(OpenAI ChatGPT)를 통한 주문 내역 자동 분석
- 상품 목록과 주문 내역 매핑
- 데이터베이스 자동 저장
- 관리자 검수 및 수정 기능

## 기술 스택

- **Frontend**: React, TypeScript, Vite
- **UI**: shadcn-ui, Tailwind CSS
- **Backend**: Supabase
- **AI**: OpenAI ChatGPT API
- **File Processing**: 텍스트 파일 파싱

## 환경 설정

### 1. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 다음 변수들을 설정하세요:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# OpenAI API Configuration
VITE_OPENAI_API_KEY=your_openai_api_key_here

# Gmail Email Configuration (주문 완료 이메일 발송용)
GMAIL_USER=your_gmail_address@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
ORDER_EMAIL_RECIPIENT=recipient_email@gmail.com
```

### 2. OpenAI API 키 발급
1. [OpenAI Platform](https://platform.openai.com/api-keys)에 접속
2. API 키 생성
3. `.env` 파일에 `VITE_OPENAI_API_KEY`로 설정

### 3. Gmail 이메일 설정 (주문 완료 알림용)
주문 완료 시 자동으로 이메일이 발송되도록 Gmail을 설정합니다:

1. **Gmail 앱 비밀번호 생성**
   - Google 계정 설정 페이지로 이동: https://myaccount.google.com/
   - 보안 > 2단계 인증 활성화 (필수)
   - 보안 > 앱 비밀번호 생성
   - "메일" 및 "기타(맞춤 이름)" 선택 후 이름 입력 (예: "주문 시스템")
   - 생성된 16자리 앱 비밀번호 복사

2. **환경변수 설정**
   - `GMAIL_USER`: 발송할 Gmail 주소 (예: yourname@gmail.com)
   - `GMAIL_APP_PASSWORD`: 위에서 생성한 16자리 앱 비밀번호
   - `ORDER_EMAIL_RECIPIENT`: 주문 알림을 받을 이메일 주소 (기본 수신자)

**참고**: 앱 비밀번호는 일반 Gmail 비밀번호가 아닙니다. 2단계 인증을 활성화한 후 생성해야 합니다.

### 4. 카카오톡 대화 내보내기
1. 카카오톡에서 대화방 선택
2. 설정 > 대화 내보내기
3. 텍스트 파일(.txt)로 저장
4. 시스템에서 해당 파일 업로드

## 사용법

### 개발 환경 실행

#### 기본 개발 서버 (권장)
```sh
# Vercel CLI로 개발 서버 실행 (서버리스 함수 포함)
npm run dev
```

#### 프론트엔드만 실행
```sh
# Vite 개발 서버 실행
npm run dev
```

### 주문 내역 업로드
1. **주문내역** 탭으로 이동
2. **주문내역 업로드** 버튼 클릭
3. 날짜 입력 (YYMMDD 형식, 예: 250701)
4. 카카오톡 대화 파일(.txt) 선택
5. **주문내역 분석하기** 버튼 클릭
6. AI가 주문 내역을 분석하고 상품과 매핑
7. 결과 확인 후 **데이터베이스 저장**

### 주문 내역 조회 및 관리
1. **주문내역** 탭에서 날짜 검색 (YYMMDD 형식)
2. 주문자별로 그룹화된 주문 내역 확인
3. 상품별 수량, 가격, 유사도 확인
4. 원본 주문 텍스트 확인
5. **검수 필요** 표시된 주문내역 수정/삭제
6. 관리자가 직접 상품명, 수량, 가격 수정 가능

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/a78ca175-a8d2-4f79-adc6-3ca311de0105) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Set up environment variables
# Create a .env file and add the following:
# VITE_GOOGLE_API_KEY=your_google_api_key_here
# VITE_SPREADSHEET_ID=14f29cGpEAITHa8gb60JcyXMONPj0KCt7FKKuj1gYrm8
# See GOOGLE_SHEETS_API_SETUP.md for detailed setup instructions

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/a78ca175-a8d2-4f79-adc6-3ca311de0105) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
# jhshop
# jhshop
# jhshop
