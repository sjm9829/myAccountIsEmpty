#  My Account Is Empty - 주식 포트폴리오 관리 웹앱

개인 주식 포트폴리오를 통합 관리할 수 있는 웹 애플리케이션입니다.

## 🚀 주요 기능

- **계좌 통합 관리**: 여러 금융기관(증권사, 은행, 보험사, 가상화폐 거래소 등) 계좌를 한 곳에서 관리
- **포트폴리오 추적**: 보유 종목별 실시간 수익률 추적
- **거래 내역 관리**: 매매 거래 기록 및 분석
- **데이터 시각화**: 직관적인 차트를 통한 포트폴리오 분석
- **수익률 계산**: 자동 수익률 계산 및 통계 제공

## 🛠️ 기술 스택

### Frontend
- **Next.js 15** - React 기반 풀스택 프레임워크
- **TypeScript** - 타입 안전성
- **Tailwind CSS** - 유틸리티 기반 CSS 프레임워크
- **Chart.js** - 데이터 시각화

### Backend
- **Next.js API Routes** - 서버리스 API
- **Prisma ORM** - 타입 안전한 데이터베이스 ORM
- **SQLite** (개발) / **PostgreSQL** (프로덕션)

### Authentication & Security
- **NextAuth.js** - 인증 시스템
- **JWT** - JSON Web Token
- **bcryptjs** - 비밀번호 해싱

## 📦 설치 및 실행

### 사전 요구사항
- Node.js 18.x 이상
- npm 또는 yarn

### 설치
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 필요한 환경 변수를 설정하세요

# 데이터베이스 초기화
npx prisma generate
npx prisma migrate dev

# 개발 서버 실행
npm run dev
```

### 환경 변수 설정
`.env` 파일에서 다음 변수들을 설정하세요:

```env
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# JWT Secret
JWT_SECRET="your-jwt-secret-here"

# Stock API (Optional)
ALPHA_VANTAGE_API_KEY="demo"
```

## 🗄️ 데이터베이스 구조

- **Users**: 사용자 정보
- **Institutions**: 금융기관 정보 (증권사, 은행, 보험사, 가상화폐 거래소, 투자회사 등)
- **Accounts**: 계좌 정보
- **Holdings**: 보유 종목
- **Transactions**: 거래 내역

## 📁 프로젝트 구조

```
src/
├── app/                 # Next.js App Router
├── components/          # 재사용 가능한 컴포넌트
├── lib/                # 유틸리티 및 설정
├── types/              # TypeScript 타입 정의
└── generated/          # Prisma 클라이언트
```

---

**myAccountIsEmpty** - "계좌가 비어있다"라는 의미로, 주식 투자의 현실을 유머러스하게 표현한 프로젝트명입니다 😄
