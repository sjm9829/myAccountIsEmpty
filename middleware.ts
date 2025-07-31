import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // 보호된 경로들
  const protectedPaths = ['/dashboard', '/accounts', '/portfolio', '/transactions'];
  const authPaths = ['/login', '/register'];

  // 보호된 경로에 접근하려고 할 때
  if (protectedPaths.some(path => pathname.startsWith(path))) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // 이미 로그인한 사용자가 인증 페이지에 접근하려고 할 때
  if (authPaths.includes(pathname) && token) {
    try {
      jwt.verify(token, process.env.JWT_SECRET!);
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } catch (error) {
      // 토큰이 유효하지 않으면 그대로 진행
      console.error('Token verification failed:', error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/accounts/:path*',
    '/portfolio/:path*',
    '/transactions/:path*',
    '/login',
    '/register'
  ]
};
