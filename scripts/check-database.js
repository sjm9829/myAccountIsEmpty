import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('=== 데이터베이스 상태 확인 ===\n');
    
    // 모든 사용자 조회
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
      }
    });
    
    console.log('등록된 사용자 목록:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Email: ${user.email}, Username: ${user.username}, Role: ${user.role}`);
    });
    
    console.log('\n---\n');
    
    // 모든 금융기관 조회
    const institutions = await prisma.institution.findMany({
      select: {
        id: true,
        name: true,
        type: true,
      }
    });
    
    console.log('등록된 금융기관 목록:');
    institutions.forEach((institution, index) => {
      console.log(`${index + 1}. ID: ${institution.id}, Name: ${institution.name}, Type: ${institution.type}`);
    });
    
    console.log('\n---\n');
    
    // 특정 ID들 확인
    const specificUserId = 'cmdq87gbs0000po4kzu7ihhxh';
    const specificInstitutionId = 'cmdqx6d3h0002po90ckuer3n3';
    
    const specificUser = await prisma.user.findUnique({
      where: { id: specificUserId }
    });
    
    const specificInstitution = await prisma.institution.findUnique({
      where: { id: specificInstitutionId }
    });
    
    console.log(`특정 사용자 ID (${specificUserId}) 존재 여부:`, specificUser ? '존재함' : '존재하지 않음');
    console.log(`특정 금융기관 ID (${specificInstitutionId}) 존재 여부:`, specificInstitution ? '존재함' : '존재하지 않음');
    
    console.log('\n---\n');
    
    // 보유종목 정보 확인
    const holdings = await prisma.holding.findMany({
      include: {
        account: {
          include: {
            user: true,
            institution: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    console.log('등록된 보유종목 목록:');
    let totalInvestment = 0;
    
    holdings.forEach((holding, index) => {
      const investment = holding.quantity * holding.averagePrice;
      totalInvestment += investment;
      
      console.log(`${index + 1}. ${holding.stockName} (${holding.stockCode})`);
      console.log(`   사용자: ${holding.account.user.username}`);
      console.log(`   계좌: ${holding.account.nickname || holding.account.institution.name}`);
      console.log(`   수량: ${holding.quantity.toLocaleString()}주`);
      console.log(`   평균단가: ₩${holding.averagePrice.toLocaleString()}`);
      console.log(`   투자금액: ₩${investment.toLocaleString()}`);
      console.log(`   통화: ${holding.currency || 'KRW'}`);
      console.log('');
    });

    console.log(`총 투자 원금: ₩${totalInvestment.toLocaleString()}`);
    
  } catch (error) {
    console.error('데이터베이스 확인 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
