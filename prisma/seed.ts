import { PrismaClient, InstitutionType } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  // 다양한 금융기관 데이터 추가
  const institutions = [
    // 증권사
    { name: '삼성증권', type: InstitutionType.SECURITIES, contactNumber: '1588-0038', websiteUrl: 'https://www.samsungpop.com' },
    { name: 'KB증권', type: InstitutionType.SECURITIES, contactNumber: '1544-0003', websiteUrl: 'https://www.kbsec.com' },
    { name: '미래에셋증권', type: InstitutionType.SECURITIES, contactNumber: '1577-0050', websiteUrl: 'https://securities.miraeasset.com' },
    { name: '한국투자증권', type: InstitutionType.SECURITIES, contactNumber: '1588-0030', websiteUrl: 'https://securities.koreainvestment.com' },
    { name: 'NH투자증권', type: InstitutionType.SECURITIES, contactNumber: '1588-3366', websiteUrl: 'https://www.nhqv.com' },
    { name: 'SK증권', type: InstitutionType.SECURITIES, contactNumber: '1588-0300', websiteUrl: 'https://www.sks.co.kr' },
    { name: '키움증권', type: InstitutionType.SECURITIES, contactNumber: '1544-5000', websiteUrl: 'https://www.kiwoom.com' },
    { name: '대신증권', type: InstitutionType.SECURITIES, contactNumber: '1588-0808', websiteUrl: 'https://www.daishin.com' },
    { name: '하나증권', type: InstitutionType.SECURITIES, contactNumber: '1588-2525', websiteUrl: 'https://www.hanaw.com' },
    { name: '신한투자증권', type: InstitutionType.SECURITIES, contactNumber: '1588-0365', websiteUrl: 'https://shinhaninvest.com' },
    
    // 은행
    { name: 'KB국민은행', type: InstitutionType.BANK, contactNumber: '1599-9999', websiteUrl: 'https://www.kbstar.com' },
    { name: '신한은행', type: InstitutionType.BANK, contactNumber: '1599-8000', websiteUrl: 'https://www.shinhan.com' },
    { name: '우리은행', type: InstitutionType.BANK, contactNumber: '1599-0800', websiteUrl: 'https://www.wooribank.com' },
    { name: 'NH농협은행', type: InstitutionType.BANK, contactNumber: '1599-2100', websiteUrl: 'https://www.nonghyup.com' },
    { name: '하나은행', type: InstitutionType.BANK, contactNumber: '1599-1111', websiteUrl: 'https://www.kebhana.com' },
    { name: 'IBK기업은행', type: InstitutionType.BANK, contactNumber: '1566-2566', websiteUrl: 'https://www.ibk.co.kr' },
    
    // 보험사
    { name: '삼성생명', type: InstitutionType.INSURANCE, contactNumber: '1588-3114', websiteUrl: 'https://www.samsunglife.com' },
    { name: '한화생명', type: InstitutionType.INSURANCE, contactNumber: '1588-6363', websiteUrl: 'https://www.hanwhalife.com' },
    { name: '교보생명', type: InstitutionType.INSURANCE, contactNumber: '1588-1001', websiteUrl: 'https://www.kyobo.co.kr' },
    { name: '동양생명', type: InstitutionType.INSURANCE, contactNumber: '1588-1170', websiteUrl: 'https://www.myangel.co.kr' },
    
    // 가상화폐 거래소
    { name: '빗썸', type: InstitutionType.CRYPTO, contactNumber: '1661-5551', websiteUrl: 'https://www.bithumb.com' },
    { name: '업비트', type: InstitutionType.CRYPTO, contactNumber: '1588-0560', websiteUrl: 'https://upbit.com' },
    { name: '코인원', type: InstitutionType.CRYPTO, contactNumber: '1588-2828', websiteUrl: 'https://coinone.co.kr' },
    { name: '코빗', type: InstitutionType.CRYPTO, contactNumber: '02-6925-6800', websiteUrl: 'https://www.korbit.co.kr' },
    
    // 투자회사/자산운용사
    { name: '미래에셋자산운용', type: InstitutionType.INVESTMENT, contactNumber: '1577-1090', websiteUrl: 'https://www.miraeassetam.co.kr' },
    { name: '삼성자산운용', type: InstitutionType.INVESTMENT, contactNumber: '1588-8888', websiteUrl: 'https://www.samsungfund.com' },
    { name: 'KB자산운용', type: InstitutionType.INVESTMENT, contactNumber: '1588-1188', websiteUrl: 'https://www.kbam.co.kr' },
    { name: 'NH-Amundi자산운용', type: InstitutionType.INVESTMENT, contactNumber: '1588-7171', websiteUrl: 'https://www.nh-amundi.com' },
  ];

  console.log('금융기관 데이터 추가 중...');

  for (const institution of institutions) {
    await prisma.institution.upsert({
      where: { name: institution.name },
      update: {},
      create: institution,
    });
  }

  console.log('금융기관 데이터 추가 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
