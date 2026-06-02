/**
 * Utility to sanitize database/RLS errors to prevent exposing internal schema,
 * table, or policy names to the user interface.
 */
export function sanitizeDatabaseError(error: any): string {
  if (!error) {
    return 'An unknown database error occurred.';
  }

  // Extract all potential error message strings
  const message = (error.message || '').toLowerCase();
  const metaMessage = (error.meta?.message || '').toLowerCase();
  const driverMessage = (error.meta?.driverAdapterError?.cause?.message || '').toLowerCase();
  const code = error.code || '';

  // 1. Check for Row-Level Security policy violations
  if (
    message.includes('row-level security') ||
    metaMessage.includes('row-level security') ||
    driverMessage.includes('row-level security') ||
    code === 'P2011' || // Null constraint violation (can occur if schema prevents write)
    code === 'P2025' // Record to update not found (commonly returned by Prisma when RLS filters the row)
  ) {
    return 'Access denied: You do not have permission to perform this action under the active tenant context.';
  }

  // 2. Check for Foreign Key constraint violations
  if (
    message.includes('foreign key') ||
    metaMessage.includes('foreign key') ||
    driverMessage.includes('foreign key') ||
    code === 'P2003'
  ) {
    return 'This record is currently referenced by other data and cannot be deleted or modified.';
  }

  // 3. Check for Unique constraint / duplicate key violations
  if (
    message.includes('unique constraint') ||
    metaMessage.includes('unique constraint') ||
    driverMessage.includes('unique constraint') ||
    code === 'P2002'
  ) {
    return 'A record with this email or identifier already exists.';
  }

  // 4. Fallback: Clean error message
  // Strip any raw database quotes, parentheses, table/column names, or stack traces
  let cleanMsg = error.message || 'A database error occurred.';
  cleanMsg = cleanMsg.split('\n')[0]; // Take only the first line of the error trace
  
  // Remove technical path/module traces if present
  if (cleanMsg.includes('PrismaClient')) {
    cleanMsg = 'Failed to execute database operation.';
  }

  return cleanMsg;
}
