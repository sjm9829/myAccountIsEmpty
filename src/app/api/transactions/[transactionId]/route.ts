import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface JwtPayload {
  userId: string;
  email: string;
}

function getUserFromToken(request: NextRequest): string | null {
  const token = request.cookies.get('token')?.value;
  
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

// DELETE: 거래 내역 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { transactionId: string } }
) {
  try {
    const userId = getUserFromToken(request);
    
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { transactionId } = params;

    // 거래 내역 존재 및 소유권 확인
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: transactionId,
        account: {
          userId: userId,
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: '거래 내역을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 거래 삭제 시 보유종목 역산 처리 (매우 복잡하므로 간단히 처리)
    // 실제 서비스에서는 더 정교한 로직이 필요합니다.
    
    // 거래 내역 삭제
    await prisma.transaction.delete({
      where: {
        id: transactionId,
      },
    });

    return NextResponse.json({ message: '거래 내역이 성공적으로 삭제되었습니다.' });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json(
      { error: '거래 내역 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
