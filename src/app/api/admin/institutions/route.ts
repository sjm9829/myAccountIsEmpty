import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// GET: 관리자가 모든 금융기관 조회
export async function GET(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin(request);
    
    if (!adminUserId) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const institutions = await prisma.institution.findMany({
      include: {
        _count: {
          select: {
            accounts: true,
          },
        },
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ institutions });
  } catch (error) {
    console.error('Failed to fetch institutions:', error);
    return NextResponse.json(
      { error: '금융기관 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 관리자가 새 금융기관 등록
export async function POST(request: NextRequest) {
  try {
    const adminUserId = await requireAdmin(request);
    
    if (!adminUserId) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { name, type, contactNumber, websiteUrl } = await request.json();

    if (!name || !type) {
      return NextResponse.json(
        { error: '기관명과 유형은 필수입니다.' },
        { status: 400 }
      );
    }

    // 중복 확인
    const existingInstitution = await prisma.institution.findUnique({
      where: { name },
    });

    if (existingInstitution) {
      return NextResponse.json(
        { error: '이미 등록된 금융기관입니다.' },
        { status: 400 }
      );
    }

    const institution = await prisma.institution.create({
      data: {
        name,
        type,
        contactNumber: contactNumber || null,
        websiteUrl: websiteUrl || null,
      },
    });

    return NextResponse.json({ institution }, { status: 201 });
  } catch (error) {
    console.error('Failed to create institution:', error);
    return NextResponse.json(
      { error: '금융기관 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
