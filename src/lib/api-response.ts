import { NextResponse } from 'next/server';

import { isAppError, getErrorMessage } from '@/lib/errors';

/**
 * Typed response helpers for Next.js API routes.
 * Use these instead of constructing NextResponse directly for consistent
 * response shapes across all endpoints.
 */

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: string;
}

/**
 * Returns a 200 (or custom status) JSON response with `{ data: T }`.
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ data }, { status });
}

/**
 * Returns a 201 JSON response — use for resource creation endpoints.
 */
export function createdResponse<T>(data: T): NextResponse<ApiSuccess<T>> {
  return successResponse(data, 201);
}

/**
 * Returns a JSON error response with `{ error: string }`.
 */
export function errorResponse(message: string, status = 500): NextResponse<ApiError> {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Converts any thrown error into a properly-shaped API error response.
 * Handles known AppErrors with their built-in status codes.
 */
export function handleApiError(err: unknown): NextResponse<ApiError> {
  if (isAppError(err)) {
    return errorResponse(err.message, err.statusCode);
  }
  const message = getErrorMessage(err);
  return errorResponse(message, 500);
}

/**
 * Returns a 400 Bad Request response.
 */
export function badRequest(message: string): NextResponse<ApiError> {
  return errorResponse(message, 400);
}

/**
 * Returns a 404 Not Found response.
 */
export function notFound(message = 'Not found'): NextResponse<ApiError> {
  return errorResponse(message, 404);
}

/**
 * Returns a 409 Conflict response.
 */
export function conflict(message: string): NextResponse<ApiError> {
  return errorResponse(message, 409);
}
