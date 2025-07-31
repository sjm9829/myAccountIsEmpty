import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  iat?: number;
  exp?: number;
}

export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export function verifyTokenString(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function verifyToken(request: NextRequest): Promise<JWTPayload | null> {
  try {
    console.log('Auth: Starting token verification');
    
    // 먼저 Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization');
    console.log('Auth: Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('Auth: Using Bearer token');
      return verifyTokenString(token);
    }

    // 쿠키에서 토큰 확인
    const token = request.cookies.get('auth-token')?.value;
    console.log('Auth: Cookie token:', token ? 'Present' : 'Missing');
    console.log('Auth: All cookies:', request.cookies.getAll().map(c => c.name));
    
    if (!token) {
      console.log('Auth: No token found in cookies or headers');
      return null;
    }

    console.log('Auth: Attempting to verify cookie token');
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    console.log('Auth: Token verification successful for user:', payload.userId);
    return payload;
  } catch (error) {
    console.error('Auth: Token verification failed:', error);
    return null;
  }
}

export function extractTokenFromRequest(request: NextRequest): string | null {
  // Authorization 헤더에서 토큰 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 쿠키에서 토큰 확인
  const token = request.cookies.get('auth-token')?.value;
  return token || null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    
    return user?.role === 'ADMIN';
  } catch (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
}

export async function requireAdmin(request: NextRequest): Promise<string | null> {
  const payload = await verifyToken(request);
  
  if (!payload) {
    return null;
  }
  
  const adminStatus = await isAdmin(payload.userId);
  
  if (!adminStatus) {
    return null;
  }
  
  return payload.userId;
}
