import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 금융기관 목록 조회
export async function GET() {
  try {
    const institutions = await prisma.institution.findMany({
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ],
    });

    return NextResponse.json({ institutions });
  } catch (error) {
    console.error('Failed to fetch institutions:', error);
    return NextResponse.json(
      { error: '금융기관 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
