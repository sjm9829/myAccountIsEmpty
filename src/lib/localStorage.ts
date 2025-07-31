import CryptoJS from 'crypto-js';

// 암호화 키 생성 (실제로는 사용자가 설정한 비밀번호 사용)
const ENCRYPTION_KEY = 'myAccountIsEmpty-secret-key';

export interface PortfolioData {
  accounts: Array<{
    id: string;
    name: string;
    broker: string;
    accountNumber: string;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    accountId: string;
    type: 'BUY' | 'SELL';
    stockCode: string;
    stockName: string;
    quantity: number;
    price: number;
    fee: number;
    transactionDate: string;
    createdAt: string;
  }>;
  holdings: Array<{
    id: string;
    accountId: string;
    stockCode: string;
    stockName: string;
    quantity: number;
    averagePrice: number;
    currentPrice?: number;
    updatedAt: string;
  }>;
  settings: {
    theme: 'light' | 'dark';
    currency: 'KRW' | 'USD';
    language: 'ko' | 'en';
    notifications: boolean;
  };
}

class LocalStorageManager {
  private readonly STORAGE_KEY = 'myAccountIsEmpty_portfolio';

  // 데이터 암호화
  private encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  // 데이터 복호화
  private decrypt(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  // 데이터 저장
  saveData(data: PortfolioData): void {
    try {
      const jsonData = JSON.stringify(data);
      const encryptedData = this.encrypt(jsonData);
      localStorage.setItem(this.STORAGE_KEY, encryptedData);
    } catch (error) {
      console.error('데이터 저장 실패:', error);
      throw new Error('데이터 저장에 실패했습니다.');
    }
  }

  // 데이터 로드
  loadData(): PortfolioData | null {
    try {
      const encryptedData = localStorage.getItem(this.STORAGE_KEY);
      if (!encryptedData) {
        return this.getDefaultData();
      }

      const decryptedData = this.decrypt(encryptedData);
      return JSON.parse(decryptedData) as PortfolioData;
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      return this.getDefaultData();
    }
  }

  // 기본 데이터 구조
  private getDefaultData(): PortfolioData {
    return {
      accounts: [],
      transactions: [],
      holdings: [],
      settings: {
        theme: 'light',
        currency: 'KRW',
        language: 'ko',
        notifications: true,
      },
    };
  }

  // 데이터 초기화
  clearData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // 데이터 내보내기 (백업)
  exportData(): string {
    const data = this.loadData();
    return JSON.stringify(data, null, 2);
  }

  // 데이터 가져오기 (복원)
  importData(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData) as PortfolioData;
      this.saveData(data);
    } catch (error) {
      console.error('데이터 가져오기 실패:', error);
      throw new Error('잘못된 데이터 형식입니다.');
    }
  }

  // 계좌 추가
  addAccount(account: Omit<PortfolioData['accounts'][0], 'id' | 'createdAt'>) {
    const data = this.loadData();
    if (!data) return;

    const newAccount = {
      ...account,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    data.accounts.push(newAccount);
    this.saveData(data);
    return newAccount;
  }

  // 거래 내역 추가
  addTransaction(transaction: Omit<PortfolioData['transactions'][0], 'id' | 'createdAt'>) {
    const data = this.loadData();
    if (!data) return;

    const newTransaction = {
      ...transaction,
      id: this.generateId(),
      createdAt: new Date().toISOString(),
    };

    data.transactions.push(newTransaction);
    
    // 보유 종목 업데이트
    this.updateHoldings(data, newTransaction);
    
    this.saveData(data);
    return newTransaction;
  }

  // 보유 종목 업데이트
  private updateHoldings(data: PortfolioData, transaction: PortfolioData['transactions'][0]) {
    const existingHolding = data.holdings.find(
      h => h.accountId === transaction.accountId && h.stockCode === transaction.stockCode
    );

    if (existingHolding) {
      if (transaction.type === 'BUY') {
        const totalValue = existingHolding.quantity * existingHolding.averagePrice + 
                          transaction.quantity * transaction.price;
        const totalQuantity = existingHolding.quantity + transaction.quantity;
        existingHolding.averagePrice = totalValue / totalQuantity;
        existingHolding.quantity = totalQuantity;
      } else { // SELL
        existingHolding.quantity -= transaction.quantity;
        if (existingHolding.quantity <= 0) {
          const index = data.holdings.indexOf(existingHolding);
          data.holdings.splice(index, 1);
        }
      }
      existingHolding.updatedAt = new Date().toISOString();
    } else if (transaction.type === 'BUY') {
      data.holdings.push({
        id: this.generateId(),
        accountId: transaction.accountId,
        stockCode: transaction.stockCode,
        stockName: transaction.stockName,
        quantity: transaction.quantity,
        averagePrice: transaction.price,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // ID 생성
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}

export const portfolioStorage = new LocalStorageManager();
