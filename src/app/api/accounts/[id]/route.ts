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
  
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return payload.userId;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// PUT: 계좌 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('PUT request received for account ID:', params.id);
  
  try {
    const userId = getUserFromToken(request);
    console.log('User ID from token:', userId);
    
    if (!userId) {
      console.log('No user ID found, returning 401');
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    const { institutionId, accountNumber, accountType, nickname } = requestBody;

    if (!institutionId || !accountNumber || !accountType) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 기존 계좌가 사용자의 것인지 확인
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: params.id,
        userId: userId,
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: '계좌를 찾을 수 없거나 수정 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 금융기관 존재 확인
    const institution = await prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      return NextResponse.json(
        { error: '존재하지 않는 금융기관입니다.' },
        { status: 400 }
      );
    }

    // 계좌번호 중복 확인 (자기 자신 제외)
    const duplicateAccount = await prisma.account.findFirst({
      where: {
        userId: userId,
        institutionId: institutionId,
        accountNumber: accountNumber,
        NOT: {
          id: params.id,
        },
      },
    });

    if (duplicateAccount) {
      return NextResponse.json(
        { error: '이미 등록된 계좌입니다.' },
        { status: 400 }
      );
    }

    const updatedAccount = await prisma.account.update({
      where: { id: params.id },
      data: {
        institutionId: institutionId,
        accountNumber: accountNumber,
        accountType: accountType,
        nickname: nickname || null,
      },
      include: {
        institution: true,
      },
    });

    console.log('Account updated successfully:', updatedAccount);
    return NextResponse.json({ account: updatedAccount });
  } catch (error: any) {
    console.error('Failed to update account:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: '외래 키 제약 조건 위반: 금융기관 정보가 올바르지 않습니다.' },
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
      { error: '계좌 수정 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: 계좌 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 기존 계좌가 사용자의 것인지 확인
    const existingAccount = await prisma.account.findFirst({
      where: {
        id: params.id,
        userId: userId,
      },
    });

    if (!existingAccount) {
      return NextResponse.json(
        { error: '계좌를 찾을 수 없거나 삭제 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 관련 데이터 확인 (보유 종목, 거래 내역 등)
    const holdingsCount = await prisma.holding.count({
      where: { accountId: params.id },
    });

    const transactionsCount = await prisma.transaction.count({
      where: { accountId: params.id },
    });

    if (holdingsCount > 0 || transactionsCount > 0) {
      return NextResponse.json(
        { error: '보유 종목이나 거래 내역이 있는 계좌는 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    await prisma.account.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: '계좌가 삭제되었습니다.' });
  } catch (error: any) {
    console.error('Failed to delete account:', error);
    
    return NextResponse.json(
      { error: '계좌 삭제 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
