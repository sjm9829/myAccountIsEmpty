import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JwtPayload {
  userId: string;
  email: string;
}

function getUserFromToken(request: NextRequest): string | null {
  // 먼저 auth-token 쿠키를 확인
  let token = request.cookies.get('auth-token')?.value;
  
  // auth-token이 없으면 token 쿠키를 확인
  if (!token) {
    token = request.cookies.get('token')?.value;
  }
  
  console.log('사용 가능한 쿠키들:', request.cookies.getAll().map(c => c.name));
  console.log('추출한 토큰:', token ? '존재함' : '없음');
  
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    console.log('토큰에서 추출한 사용자 ID:', payload.userId);
    return payload.userId;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// GET: 사용자의 계좌 목록 조회
export async function GET(request: NextRequest) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const accounts = await prisma.account.findMany({
      where: {
        userId: userId,
      },
      include: {
        institution: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json(
      { error: '계좌 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 계좌 등록
export async function POST(request: NextRequest) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { institutionId, accountNumber, accountType, nickname } = await request.json();

    console.log('계좌 생성 요청 데이터:', {
      userId,
      institutionId,
      accountNumber,
      accountType,
      nickname
    });

    if (!institutionId || !accountNumber || !accountType) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 계좌번호 중복 확인
    const existingAccount = await prisma.account.findFirst({
      where: {
        userId: userId,
        institutionId: institutionId,
        accountNumber: accountNumber,
      },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: '이미 등록된 계좌입니다.' },
        { status: 400 }
      );
    }

    // 금융기관 존재 확인
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
    });

    console.log('금융기관 조회 결과:', institution);

    if (!institution) {
      return NextResponse.json(
        { error: '존재하지 않는 금융기관입니다.' },
        { status: 400 }
      );
    }

    // 사용자 존재 확인 추가
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    console.log('사용자 조회 결과:', user);

    if (!user) {
      return NextResponse.json(
        { error: '존재하지 않는 사용자입니다.' },
        { status: 400 }
      );
    }

    const account = await prisma.account.create({
      data: {
        userId: userId,
        institutionId: institutionId,
        accountNumber: accountNumber,
        accountType: accountType,
        nickname: nickname || null,
      },
      include: {
        institution: true,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create account:', error);
    
    // Prisma 에러 코드별 처리
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '외래 키 제약 조건 위반: 사용자 또는 금융기관 정보가 올바르지 않습니다.' },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: '이미 등록된 계좌입니다.' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: '계좌 등록 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
