/**
 * Audit logging utilities
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { headers } from 'next/headers';
import { NextRequest } from 'next/server';

export type AuditActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'SELECT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'ACCESS'
  | 'EXPORT';

export interface AuditLogData {
  userId: string;
  actionType: AuditActionType;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Get client IP address from request headers
 */
function getClientIP(request?: NextRequest): string | null {
  try {
    if (request) {
      const forwardedFor = request.headers.get('x-forwarded-for');
      if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
      }
      return request.headers.get('x-real-ip') || request.ip || null;
    }

    const headersList = headers();
    // Check various headers for IP (in order of preference)
    const forwardedFor = headersList.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIP = headersList.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get user agent from request headers
 */
function getUserAgent(request?: NextRequest): string | null {
  try {
    if (request) {
      return request.headers.get('user-agent');
    }

    const headersList = headers();
    return headersList.get('user-agent');
  } catch {
    return null;
  }
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  data: AuditLogData,
  request?: NextRequest
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data: result, error } = await supabase.rpc('create_audit_log', {
      p_user_id: data.userId,
      p_action_type: data.actionType,
      p_resource_type: data.resourceType,
      p_resource_id: data.resourceId || null,
      p_old_values: data.oldValues || null,
      p_new_values: data.newValues || null,
      p_ip_address: getClientIP(request),
      p_user_agent: getUserAgent(request),
      p_metadata: data.metadata || {},
    });

    if (error) {
      console.error('[Audit] Error creating audit log:', error);
      return null;
    }

    return result || null;
  } catch (error) {
    console.error('[Audit] Exception creating audit log:', error);
    return null;
  }
}

/**
 * Log user login
 */
export async function logLogin(
  userId: string,
  success: boolean,
  request?: NextRequest
): Promise<void> {
  await createAuditLog(
    {
      userId,
      actionType: 'LOGIN',
      resourceType: 'auth',
      metadata: {
        success,
        timestamp: new Date().toISOString(),
      },
    },
    request
  );
}

/**
 * Log user logout
 */
export async function logLogout(userId: string, request?: NextRequest): Promise<void> {
  await createAuditLog(
    {
      userId,
      actionType: 'LOGOUT',
      resourceType: 'auth',
    },
    request
  );
}

/**
 * Log data access
 */
export async function logDataAccess(
  userId: string,
  resourceType: string,
  resourceId?: string,
  request?: NextRequest
): Promise<void> {
  await createAuditLog(
    {
      userId,
      actionType: 'ACCESS',
      resourceType,
      resourceId,
    },
    request
  );
}

/**
 * Log data export
 */
export async function logDataExport(
  userId: string,
  resourceType: string,
  format: string,
  request?: NextRequest
): Promise<void> {
  await createAuditLog(
    {
      userId,
      actionType: 'EXPORT',
      resourceType,
      metadata: {
        format,
        timestamp: new Date().toISOString(),
      },
    },
    request
  );
}

/**
 * Log data modification
 */
export async function logDataModification(
  userId: string,
  actionType: 'CREATE' | 'UPDATE' | 'DELETE',
  resourceType: string,
  resourceId: string,
  oldValues?: Record<string, any>,
  newValues?: Record<string, any>,
  request?: NextRequest
): Promise<void> {
  await createAuditLog(
    {
      userId,
      actionType,
      resourceType,
      resourceId,
      oldValues,
      newValues,
    },
    request
  );
}

