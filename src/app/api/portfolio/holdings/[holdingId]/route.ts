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

// PUT: 보유종목 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { holdingId: string } }
) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { holdingId } = params;
    const { accountId, stockCode, stockName, quantity, averagePrice, currency = 'KRW' } = await request.json();

    if (!accountId || !stockCode || !stockName || !quantity || !averagePrice) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 기존 보유종목이 사용자의 것인지 확인
    const existingHolding = await prisma.holding.findFirst({
      where: {
        id: holdingId,
        account: {
          userId: userId,
        },
      },
    });

    if (!existingHolding) {
      return NextResponse.json(
        { error: '보유종목을 찾을 수 없거나 수정 권한이 없습니다.' },
        { status: 404 }
      );
    }

    // 계좌 소유권 확인
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        userId: userId,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: '계좌를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 동일 계좌의 동일 종목 중복 확인 (자기 자신 제외)
    const duplicateHolding = await prisma.holding.findFirst({
      where: {
        accountId: accountId,
        stockCode: stockCode,
        NOT: {
          id: holdingId,
        },
      },
    });

    if (duplicateHolding) {
      return NextResponse.json(
        { error: '해당 계좌에 이미 동일한 종목이 등록되어 있습니다.' },
        { status: 400 }
      );
    }

    const updatedHolding = await prisma.holding.update({
      where: { id: holdingId },
      data: {
        accountId: accountId,
        stockCode: stockCode,
        stockName: stockName,
        quantity: quantity,
        averagePrice: averagePrice,
        currency: currency,
      },
      include: {
        account: {
          include: {
            institution: true,
          },
        },
      },
    });

    return NextResponse.json({ holding: updatedHolding });
  } catch (error: unknown) {
    console.error('Failed to update holding:', error);
    
    return NextResponse.json(
      { error: '보유종목 수정 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: 보유종목 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { holdingId: string } }
) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { holdingId } = params;

    // 보유종목 존재 및 소유권 확인
    const holding = await prisma.holding.findFirst({
      where: {
        id: holdingId,
        account: {
          userId: userId,
        },
      },
    });

    if (!holding) {
      return NextResponse.json(
        { error: '보유종목을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 보유종목 삭제
    await prisma.holding.delete({
      where: {
        id: holdingId,
      },
    });

    return NextResponse.json({ message: '보유종목이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Failed to delete holding:', error);
    return NextResponse.json(
      { error: '보유종목 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
