import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function compareHoldingsVsTransactions() {
  try {
    console.log('=== 보유종목 vs 거래내역 비교 ===\n');
    
    // 모든 거래내역 조회
    const transactions = await prisma.transaction.findMany({
      include: {
        account: {
          include: {
            user: true,
            institution: true,
          },
        },
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    console.log(`총 ${transactions.length}개의 거래내역이 있습니다.\n`);

    // 거래내역 분석
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    const stockTransactions = {};

    transactions.forEach((transaction, index) => {
      const amount = transaction.quantity * transaction.price;
      
      console.log(`${index + 1}. ${transaction.stockName} (${transaction.stockCode})`);
      console.log(`   날짜: ${transaction.transactionDate.toISOString().split('T')[0]}`);
      console.log(`   타입: ${transaction.transactionType}`);
      console.log(`   수량: ${transaction.quantity.toLocaleString()}주`);
      console.log(`   단가: ₩${transaction.price.toLocaleString()}`);
      console.log(`   금액: ₩${amount.toLocaleString()}`);
      console.log(`   수수료: ₩${transaction.fees?.toLocaleString() || 0}`);
      console.log(`   세금: ₩${transaction.tax?.toLocaleString() || 0}`);
      console.log(`   총액: ₩${transaction.totalAmount?.toLocaleString() || amount}`);
      console.log('');

      // 종목별 집계
      if (!stockTransactions[transaction.stockCode]) {
        stockTransactions[transaction.stockCode] = {
          stockName: transaction.stockName,
          buyQuantity: 0,
          sellQuantity: 0,
          buyAmount: 0,
          sellAmount: 0,
          transactions: []
        };
      }

      stockTransactions[transaction.stockCode].transactions.push(transaction);

      if (transaction.transactionType === 'BUY') {
        totalBuyAmount += transaction.totalAmount || amount;
        stockTransactions[transaction.stockCode].buyQuantity += transaction.quantity;
        stockTransactions[transaction.stockCode].buyAmount += (transaction.totalAmount || amount);
      } else if (transaction.transactionType === 'SELL') {
        totalSellAmount += transaction.totalAmount || amount;
        stockTransactions[transaction.stockCode].sellQuantity += transaction.quantity;
        stockTransactions[transaction.stockCode].sellAmount += (transaction.totalAmount || amount);
      }
    });

    console.log(`\n=== 거래내역 총계 ===`);
    console.log(`총 매수금액: ₩${totalBuyAmount.toLocaleString()}`);
    console.log(`총 매도금액: ₩${totalSellAmount.toLocaleString()}`);
    console.log(`순매수금액: ₩${(totalBuyAmount - totalSellAmount).toLocaleString()}`);

    // 보유종목 조회
    const holdings = await prisma.holding.findMany({
      include: {
        account: {
          include: {
            user: true,
            institution: true,
          },
        },
      },
    });

    let totalInvestment = 0;
    console.log(`\n=== 현재 보유종목 ===`);
    holdings.forEach((holding) => {
      const investment = holding.quantity * holding.averagePrice;
      totalInvestment += investment;
      
      console.log(`${holding.stockName} (${holding.stockCode})`);
      console.log(`   현재 보유수량: ${holding.quantity.toLocaleString()}주`);
      console.log(`   평균단가: ₩${holding.averagePrice.toLocaleString()}`);
      console.log(`   투자금액: ₩${investment.toLocaleString()}`);
      
      // 해당 종목의 거래내역과 비교
      if (stockTransactions[holding.stockCode]) {
        const stock = stockTransactions[holding.stockCode];
        const netQuantity = stock.buyQuantity - stock.sellQuantity;
        const netAmount = stock.buyAmount - stock.sellAmount;
        
        console.log(`   거래내역 순매수량: ${netQuantity.toLocaleString()}주`);
        console.log(`   거래내역 순매수금액: ₩${netAmount.toLocaleString()}`);
        console.log(`   수량 차이: ${(holding.quantity - netQuantity).toLocaleString()}주`);
        console.log(`   금액 차이: ₩${(investment - netAmount).toLocaleString()}`);
      } else {
        console.log(`   ⚠️ 해당 종목의 거래내역이 없습니다.`);
      }
      console.log('');
    });

    console.log(`현재 보유종목 총 투자원금: ₩${totalInvestment.toLocaleString()}`);
    console.log(`거래내역 순매수금액: ₩${(totalBuyAmount - totalSellAmount).toLocaleString()}`);
    console.log(`차이: ₩${(totalInvestment - (totalBuyAmount - totalSellAmount)).toLocaleString()}`);

    // 보유종목에는 있는데 거래내역에 없는 종목
    console.log(`\n=== 보유종목에만 있는 종목 (거래내역 없음) ===`);
    holdings.forEach(holding => {
      if (!stockTransactions[holding.stockCode]) {
        console.log(`${holding.stockName} (${holding.stockCode}) - ₩${(holding.quantity * holding.averagePrice).toLocaleString()}`);
      }
    });

    // 거래내역에는 있는데 보유종목에 없는 종목 (완전 매도)
    console.log(`\n=== 완전 매도된 종목 (거래내역에만 있음) ===`);
    Object.entries(stockTransactions).forEach(([stockCode, stock]) => {
      const netQuantity = stock.buyQuantity - stock.sellQuantity;
      if (netQuantity <= 0) {
        const hasHolding = holdings.some(h => h.stockCode === stockCode);
        if (!hasHolding) {
          console.log(`${stock.stockName} (${stockCode}) - 순매수량: ${netQuantity}, 순매수금액: ₩${(stock.buyAmount - stock.sellAmount).toLocaleString()}`);
        }
      }
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

compareHoldingsVsTransactions();
