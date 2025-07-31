import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 증권사 목록 조회
export async function GET() {
  try {
    const brokers = await prisma.broker.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({ brokers });
  } catch (error) {
    console.error('Failed to fetch brokers:', error);
    return NextResponse.json(
      { error: '증권사 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
