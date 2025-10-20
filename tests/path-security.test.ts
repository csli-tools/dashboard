import { sanitizePath, sanitizeDbPath, sanitizeCredentialsPath } from '../src/utils/path-security';
import * as path from 'path';
import * as os from 'os';

describe('Path Security', () => {
  describe('sanitizePath', () => {
    it('should resolve relative paths to absolute', () => {
      const result = sanitizePath('./test.txt');
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toContain('test.txt');
    });

    it('should expand home directory', () => {
      const result = sanitizePath('~/test.txt');
      expect(result).toContain(os.homedir());
      expect(result).toContain('test.txt');
    });

    it('should reject path traversal attempts', () => {
      expect(() => sanitizePath('../../../etc/passwd', [process.cwd()]))
        .toThrow('Path traversal attempt detected');
    });

    it('should reject null bytes', () => {
      expect(() => sanitizePath('test\0.txt'))
        .toThrow('Invalid path: contains null bytes');
    });

    it('should reject empty paths', () => {
      expect(() => sanitizePath(''))
        .toThrow('Invalid path: empty or non-string input');
    });

    it('should reject non-string inputs', () => {
      expect(() => sanitizePath(null as any))
        .toThrow('Invalid path: empty or non-string input');

      expect(() => sanitizePath(123 as any))
        .toThrow('Invalid path: empty or non-string input');
    });

    it('should allow paths within allowed base directories', () => {
      const testDir = process.cwd();
      const result = sanitizePath(path.join(testDir, 'subdir', 'file.txt'), [testDir]);

      expect(result).toContain('subdir');
      expect(result).toContain('file.txt');
    });

    it('should reject access to system directories', () => {
      const systemDirs = ['/etc/passwd', '/sys/test', '/proc/test'];

      for (const dir of systemDirs) {
        expect(() => sanitizePath(dir))
          .toThrow('Access to system directory denied');
      }
    });

    it('should handle Windows system directories', () => {
      if (process.platform === 'win32') {
        expect(() => sanitizePath('C:\\Windows\\System32\\cmd.exe'))
          .toThrow('Access to system directory denied');
      }
    });
  });

  describe('sanitizeDbPath', () => {
    it('should accept valid database extensions', () => {
      const validExts = ['.db', '.sqlite', '.sqlite3', '.db3'];

      for (const ext of validExts) {
        const result = sanitizeDbPath(`test${ext}`);
        expect(result).toContain(`test${ext}`);
      }
    });

    it('should reject invalid database extensions', () => {
      expect(() => sanitizeDbPath('test.exe'))
        .toThrow('Invalid database file extension: .exe');
    });

    it('should allow database files in home directory', () => {
      const dbPath = path.join(os.homedir(), 'myapp.db');
      const result = sanitizeDbPath(dbPath);

      expect(result).toBe(dbPath);
    });

    it('should allow database files in temp directory', () => {
      const dbPath = path.join(os.tmpdir(), 'temp.db');
      const result = sanitizeDbPath(dbPath);

      expect(result).toBe(dbPath);
    });

    it('should handle platform-specific app data directories', () => {
      let appDataPath: string;

      if (process.platform === 'win32') {
        appDataPath = path.join(os.homedir(), 'AppData', 'Local', 'app.db');
      } else if (process.platform === 'darwin') {
        appDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'app.db');
      } else {
        appDataPath = path.join(os.homedir(), '.local', 'share', 'app.db');
      }

      const result = sanitizeDbPath(appDataPath);
      expect(result).toBe(appDataPath);
    });
  });

  describe('sanitizeCredentialsPath', () => {
    it('should only allow credentials in home directory', () => {
      const credPath = path.join(os.homedir(), '.near-credentials');
      const result = sanitizeCredentialsPath(credPath);

      expect(result).toBe(credPath);
    });

    it('should reject credentials outside home directory', () => {
      expect(() => sanitizeCredentialsPath('/tmp/credentials'))
        .toThrow('Path traversal attempt detected');
    });

    it('should allow .config directory', () => {
      const credPath = path.join(os.homedir(), '.config', 'near');
      const result = sanitizeCredentialsPath(credPath);

      expect(result).toBe(credPath);
    });

    it('should handle non-existent directories', () => {
      const credPath = path.join(os.homedir(), '.near-credentials-test-' + Date.now());

      // Should not throw for non-existent directory
      expect(() => sanitizeCredentialsPath(credPath)).not.toThrow();
    });
  });

  describe('Edge cases and security scenarios', () => {
    it('should handle multiple path separators', () => {
      const result = sanitizePath('./foo//bar///baz.txt');
      expect(result).not.toContain('//');
      expect(result).toContain('baz.txt');
    });

    it('should handle paths with dots', () => {
      const result = sanitizePath('./foo/./bar/../baz.txt');
      expect(result).toContain('foo');
      expect(result).toContain('baz.txt');
      expect(result).not.toContain('..');
    });

    it('should handle symbolic links safely', () => {
      // This would need actual filesystem setup to test properly
      // For now, just ensure the path is normalized
      const result = sanitizePath('./test/../real/file.txt');
      expect(result).toContain('real');
      expect(result).toContain('file.txt');
    });
  });
});