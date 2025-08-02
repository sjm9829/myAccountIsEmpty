import { prisma } from '../src/lib/prisma.ts';

async function checkHoldings() {
  try {
    console.log('=== 보유종목 상세 확인 ===');
    
    // 모든 보유종목 조회
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

    console.log(`총 ${holdings.length}개의 보유종목이 있습니다.\n`);

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
      console.log('---');
    });

    console.log(`\n총 투자 원금: ₩${totalInvestment.toLocaleString()}`);
    
    // 사용자별 투자원금 분석
    const userInvestments = {};
    holdings.forEach(holding => {
      const userId = holding.account.userId;
      const username = holding.account.user.username;
      const investment = holding.quantity * holding.averagePrice;
      
      if (!userInvestments[userId]) {
        userInvestments[userId] = {
          username,
          totalInvestment: 0,
          count: 0
        };
      }
      
      userInvestments[userId].totalInvestment += investment;
      userInvestments[userId].count += 1;
    });

    console.log('\n=== 사용자별 투자원금 ===');
    Object.entries(userInvestments).forEach(([userId, data]) => {
      console.log(`${data.username}: ₩${data.totalInvestment.toLocaleString()} (${data.count}개 종목)`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkHoldings();
