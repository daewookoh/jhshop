# Google Sheets API 설정 가이드 (서비스 계정 방식)

## 1. Google Cloud Console에서 프로젝트 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 기존 프로젝트 선택 또는 새 프로젝트 생성
3. 프로젝트 이름: `jaehyung-shop` (또는 원하는 이름)

## 2. Google Sheets API 활성화

1. Google Cloud Console에서 "API 및 서비스" > "라이브러리" 클릭
2. "Google Sheets API" 검색
3. "Google Sheets API" 클릭 후 "사용" 버튼 클릭

## 3. 서비스 계정 생성

1. "API 및 서비스" > "사용자 인증 정보" 클릭
2. "사용자 인증 정보 만들기" > "서비스 계정" 클릭
3. 서비스 계정 정보 입력:
   - **이름**: `magic-shop-service`
   - **ID**: `magic-shop-service`
   - **설명**: `Magic Shop Google Sheets API Service`
4. "만들기 및 계속하기" 클릭

## 4. 서비스 계정 키 생성

1. 생성된 서비스 계정 클릭
2. "키" 탭 클릭
3. "키 추가" > "새 키 만들기" 클릭
4. "JSON" 선택 후 "만들기" 클릭
5. 다운로드된 JSON 파일을 안전한 곳에 보관

## 5. 스프레드시트 공유 설정

1. Google Sheets에서 해당 스프레드시트 열기
2. "공유" 버튼 클릭
3. 서비스 계정 이메일 주소 추가 (예: `magic-shop-service@jaehyung-shop.iam.gserviceaccount.com`)
4. "편집자" 권한으로 설정
5. "완료" 클릭

## 6. 백엔드 서버 실행

### 방법 1: 백엔드만 실행
```bash
npm run backend
```

### 방법 2: 개발 모드로 실행
```bash
npm run backend:dev
```

## 7. 프론트엔드 설정

1. `.env` 파일 생성:
```env
VITE_BACKEND_API_URL=http://localhost:3001/api
```

2. 프론트엔드 개발 서버 실행:
```bash
npm run dev
```

## 8. 테스트

1. 백엔드 서버 실행: `npm run backend`
2. 프론트엔드 개발 서버 실행: `npm run dev`
3. 주문 업로드 기능 테스트
4. Google Sheets에서 데이터 확인

## 문제 해결

### 403 Forbidden 오류
- 서비스 계정이 스프레드시트에 공유되어 있는지 확인
- 서비스 계정 키가 올바른지 확인
- Google Sheets API가 활성화되었는지 확인

### 400 Bad Request 오류
- 스프레드시트 ID가 올바른지 확인
- 서비스 계정 JSON 파일의 형식이 올바른지 확인

### 백엔드 서버 연결 오류
- 백엔드 서버가 실행 중인지 확인 (`http://localhost:3001`)
- CORS 설정이 올바른지 확인

## 보안 주의사항

1. **서비스 계정 JSON 파일을 절대 공개 저장소에 커밋하지 마세요**
2. **프로덕션에서는 환경변수로 서비스 계정 정보를 관리하세요**
3. **서비스 계정의 권한을 최소한으로 제한하세요**
4. **정기적으로 서비스 계정 키를 갱신하세요**

## 프로덕션 배포 시 고려사항

1. 서비스 계정 정보를 환경변수로 설정
2. HTTPS 사용
3. 적절한 CORS 설정
4. 로그 및 모니터링 설정
