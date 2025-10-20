import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Validates and sanitizes file paths to prevent directory traversal attacks
 * @param inputPath - The path to validate
 * @param allowedBasePaths - Optional array of allowed base directories
 * @returns The resolved absolute path
 * @throws Error if the path is invalid or attempts to escape allowed directories
 */
export function sanitizePath(inputPath: string, allowedBasePaths?: string[]): string {
  // Handle empty input
  if (!inputPath || typeof inputPath !== 'string') {
    throw new Error('Invalid path: empty or non-string input');
  }

  // Expand home directory if present
  let expandedPath = inputPath;
  if (inputPath.startsWith('~')) {
    expandedPath = path.join(os.homedir(), inputPath.slice(1));
  }

  // Resolve to absolute path (this also normalizes .. and . segments)
  const absolutePath = path.resolve(expandedPath);

  // Check for null bytes (security risk)
  if (absolutePath.includes('\0')) {
    throw new Error('Invalid path: contains null bytes');
  }

  // If no specific base paths are allowed, at least ensure it's not escaping the current working directory
  // or accessing system-critical directories
  const defaultAllowedPaths = allowedBasePaths || [
    process.cwd(),
    os.homedir(),
    os.tmpdir(),
  ];

  // Check if the resolved path is within any allowed base path
  const isAllowed = defaultAllowedPaths.some(basePath => {
    const resolvedBase = path.resolve(basePath);
    return absolutePath.startsWith(resolvedBase + path.sep) || absolutePath === resolvedBase;
  });

  if (!isAllowed) {
    throw new Error(`Path traversal attempt detected: ${inputPath} resolves outside allowed directories`);
  }

  // Additional security checks for sensitive system directories
  const restrictedPaths = [
    '/etc',
    '/sys',
    '/proc',
    'C:\\Windows\\System32',
    'C:\\Windows',
  ];

  const normalizedPath = absolutePath.toLowerCase();
  for (const restricted of restrictedPaths) {
    if (normalizedPath.startsWith(restricted.toLowerCase())) {
      throw new Error(`Access to system directory denied: ${restricted}`);
    }
  }

  return absolutePath;
}

/**
 * Validates a database file path
 * @param dbPath - The database path to validate
 * @returns The validated absolute path
 */
export function sanitizeDbPath(dbPath: string): string {
  // For database files, we allow paths within:
  // - Current working directory
  // - User's home directory
  // - System temp directory
  // - Specific data directories
  const allowedPaths = [
    process.cwd(),
    os.homedir(),
    os.tmpdir(),
    path.join(os.homedir(), '.local', 'share'),  // XDG data directory on Linux
    path.join(os.homedir(), 'AppData', 'Local'), // Windows app data
    path.join(os.homedir(), 'Library', 'Application Support'), // macOS app data
  ];

  const validPath = sanitizePath(dbPath, allowedPaths);

  // Ensure it has a reasonable extension
  const ext = path.extname(validPath).toLowerCase();
  if (ext && !['.db', '.sqlite', '.sqlite3', '.db3'].includes(ext)) {
    throw new Error(`Invalid database file extension: ${ext}`);
  }

  return validPath;
}

/**
 * Validates a credentials directory path
 * @param credPath - The credentials directory path to validate
 * @returns The validated absolute path
 */
export function sanitizeCredentialsPath(credPath: string): string {
  // For credentials, we're more restrictive - only allow within home directory
  const allowedPaths = [
    os.homedir(),
    path.join(os.homedir(), '.near-credentials'),
    path.join(os.homedir(), '.config'),
  ];

  const validPath = sanitizePath(credPath, allowedPaths);

  // Ensure it's a directory (or will be created as one)
  try {
    const stats = fs.statSync(validPath);
    if (!stats.isDirectory()) {
      throw new Error('Credentials path must be a directory');
    }
  } catch (e: any) {
    // Path doesn't exist yet, which is OK
    if (e.code !== 'ENOENT') {
      throw e;
    }
  }

  return validPath;
}