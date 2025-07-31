import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';

// PUT: 관리자가 금융기관 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // 기존 기관 확인
    const existingInstitution = await prisma.institution.findUnique({
      where: { id: params.id },
    });

    if (!existingInstitution) {
      return NextResponse.json(
        { error: '존재하지 않는 금융기관입니다.' },
        { status: 404 }
      );
    }

    // 이름 중복 확인 (자기 자신 제외)
    if (name !== existingInstitution.name) {
      const duplicateInstitution = await prisma.institution.findUnique({
        where: { name },
      });

      if (duplicateInstitution) {
        return NextResponse.json(
          { error: '이미 사용 중인 기관명입니다.' },
          { status: 400 }
        );
      }
    }

    const institution = await prisma.institution.update({
      where: { id: params.id },
      data: {
        name,
        type,
        contactNumber: contactNumber || null,
        websiteUrl: websiteUrl || null,
      },
    });

    return NextResponse.json({ institution });
  } catch (error) {
    console.error('Failed to update institution:', error);
    return NextResponse.json(
      { error: '금융기관 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 관리자가 금융기관 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUserId = await requireAdmin(request);
    
    if (!adminUserId) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 기존 기관 확인
    const existingInstitution = await prisma.institution.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            accounts: true,
          },
        },
      },
    });

    if (!existingInstitution) {
      return NextResponse.json(
        { error: '존재하지 않는 금융기관입니다.' },
        { status: 404 }
      );
    }

    // 연결된 계좌가 있는지 확인
    if (existingInstitution._count.accounts > 0) {
      return NextResponse.json(
        { error: '이 금융기관에 등록된 계좌가 있어 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    await prisma.institution.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: '금융기관이 삭제되었습니다.' });
  } catch (error) {
    console.error('Failed to delete institution:', error);
    return NextResponse.json(
      { error: '금융기관 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
