export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function createErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      statusCode: 500,
    };
  }

  return {
    error: 'Internal server error',
    statusCode: 500,
  };
}

import { NextResponse } from 'next/server';

export function createErrorResponseNext(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
    }, { status: error.statusCode });
  }

  if (error instanceof Error) {
    return NextResponse.json({
      error: error.message,
      statusCode: 500,
    }, { status: 500 });
  }

  return NextResponse.json({
    error: 'Internal server error',
    statusCode: 500,
  }, { status: 500 });
}






