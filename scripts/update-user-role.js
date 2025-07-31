import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function updateUserRole() {
  try {
    // sjm9829@gmail.com 사용자를 찾아서 ADMIN 역할로 변경
    const user = await prisma.user.update({
      where: {
        email: 'sjm9829@gmail.com'
      },
      data: {
        role: 'ADMIN'
      }
    });

    console.log('사용자 역할이 성공적으로 업데이트되었습니다:');
    console.log(`- 이메일: ${user.email}`);
    console.log(`- 사용자명: ${user.username}`);
    console.log(`- 역할: ${user.role}`);
    console.log(`- 업데이트 시간: ${user.updatedAt}`);
  } catch (error) {
    console.error('사용자 역할 업데이트 중 오류 발생:', error);
    
    // 사용자가 존재하지 않는 경우 확인
    if (error.code === 'P2025') {
      console.log('해당 이메일의 사용자를 찾을 수 없습니다. 등록된 사용자 목록을 확인합니다...');
      
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true
        }
      });
      
      console.log('등록된 사용자 목록:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.username}) - ${user.role}`);
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

updateUserRole();
