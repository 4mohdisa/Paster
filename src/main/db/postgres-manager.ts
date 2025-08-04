import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import https from 'node:https';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import os from 'node:os';
import postgres from 'postgres';
import { logError, logInfo, logWarn } from '../logger';

type AcceptedPlatforms = 'windows' | 'darwin' | 'linux';
type AcceptedArchs = 'arm32v7' | 'arm64v8' | 'amd64' | 'ppc64le' | 'i386';

interface PostgresDownloadInfo {
  platform: AcceptedPlatforms;
  arch: AcceptedArchs;
  url: string;
  filename: string;
  version: string;
}

const POSTGRES_VERSION = '17.5.0';

function mapPlatform(platform: string): AcceptedPlatforms {
  switch (platform.toString()) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    default:
      throw new Error(`Unsupported platform ${platform}`);
  }
}

function mapArchitecture(arch: string): AcceptedArchs {
  switch (arch.toString()) {
    case 'arm':
      return 'arm32v7';
    case 'arm64':
      return 'arm64v8';
    case 'x64':
      return 'amd64';
    case 'ppc64':
      return 'ppc64le';
    case 'ia32':
      return 'i386';
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

function generatePostgresDownloadInfo(platform: string, arch: string): PostgresDownloadInfo {
  const mappedPlatform = mapPlatform(platform);
  const mappedArch = mapArchitecture(arch);
  const mappedVersion = POSTGRES_VERSION;

  const url = `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-${mappedPlatform}-${mappedArch}/${mappedVersion}/embedded-postgres-binaries-${mappedPlatform}-${mappedArch}-${mappedVersion}.jar`;
  const filename = `embedded-postgres-binaries-${mappedPlatform}-${mappedArch}-${mappedVersion}.jar`;

  return {
    platform: mappedPlatform,
    arch: mappedArch,
    url,
    filename,
    version: mappedVersion
  };
}

let pgProcess: ChildProcess | null = null;
const DB_NAME = 'neutralstack';

export class PortablePostgresManager {
  private postgresDir: string;
  private dataDir: string;
  private binDir: string;
  private port: number;

  constructor(port = 5434) {
    this.port = port;
    this.postgresDir = path.join(app.getPath('userData'), 'postgres');
    this.dataDir = path.join(this.postgresDir, 'data');
    this.binDir = path.join(this.postgresDir, 'pgsql', 'bin');
  }

  async ensurePostgresInstalled(): Promise<void> {
    const downloadInfo = generatePostgresDownloadInfo(process.platform, process.arch);

    const isInstalled = await this.checkInstallation();
    if (isInstalled) {
      logInfo('PostgreSQL is already installed');
      return;
    }

    logInfo('PostgreSQL not found, downloading and installing...');
    await this.downloadAndExtractPostgres(downloadInfo);
    await this.initializeDatabase();
  }

  private async checkInstallation(): Promise<boolean> {
    try {
      const pgctlPath = this.getPgCtlPath();
      await fs.access(pgctlPath);

      const pgPath = this.getPgPath();
      await fs.access(pgPath);

      const initdbPath = this.getInitdbPath();
      await fs.access(initdbPath);
      const pgVersionPath = path.join(this.dataDir, 'PG_VERSION');
      await fs.access(pgVersionPath);

      return true;
    } catch {
      return false;
    }
  }

  private async downloadAndExtractPostgres(downloadInfo: PostgresDownloadInfo): Promise<void> {
    logInfo(`Downloading PostgreSQL from ${downloadInfo.url}`);

    await fs.mkdir(this.postgresDir, { recursive: true });

    try {
      logInfo('Starting download with retry mechanism...');
      const buffer = await this.downloadFile(downloadInfo.url);

      logInfo('PostgreSQL downloaded successfully, extracting...');

      await this.extractPostgresBinaries(buffer);

      if (process.platform !== 'win32') {
        const pgSqlDir = path.join(this.postgresDir, 'pgsql');
        await this.makeExecutableRecursive(pgSqlDir);
      }

      logInfo('PostgreSQL extraction completed successfully');
    } catch (error) {
      logError(`Failed to download and extract PostgreSQL: ${error}`);

      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          logError('Download timed out. This might be due to slow internet connection or server issues.');
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
          logError('Network connection failed. Please check your internet connection and firewall settings.');
        } else if (error.message.includes('AggregateError')) {
          logError('Multiple connection attempts failed. This might be a network connectivity issue.');
        }
      }

      throw error;
    }
  }

  private async makeExecutableRecursive(dir: string): Promise<void> {
    try {
      const items = await fs.readdir(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);

        if (stat.isDirectory()) {
          await this.makeExecutableRecursive(itemPath);
        } else if (stat.isFile()) {
          await fs.chmod(itemPath, 0o755);
        }
      }
    } catch (error) {
      logWarn(`Could not make files executable in ${dir}: ${error}`);
    }
  }

  private async initializeDatabase(): Promise<void> {
    const initdbPath = this.getInitdbPath();

    logInfo('Initializing PostgreSQL database...');

    await fs.mkdir(this.dataDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const initProcess = spawn(initdbPath, [
        '-D', this.dataDir,
        '-U', 'postgres',
        '--auth-local=trust',
        '--auth-host=trust',
        '--encoding=UTF8',
        '--locale=C'
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      initProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      initProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      initProcess.on('close', (code) => {
        if (code === 0) {
          logInfo('Database initialized successfully');
          resolve();
        } else {
          logError(`Database initialization failed with code ${code}`);
          logError(`Output: ${output}`);
          logError(`Error: ${errorOutput}`);
          reject(new Error(`Database initialization failed with code ${code}`));
        }
      });

      initProcess.on('error', (error) => {
        reject(new Error(`Failed to start initdb: ${error.message}`));
      });
    });
  }

  async startServer(): Promise<void> {
    if (pgProcess && !pgProcess.killed) {
      logInfo('PostgreSQL server is already running');
      return;
    }

    await this.ensurePostgresInstalled();

    const pgPath = this.getPgPath();
    const configPath = await this.createPostgresConfig();

    logInfo(`Starting PostgreSQL server on port ${this.port}...`);

    pgProcess = spawn(pgPath, [
      '-D', this.dataDir,
      '-p', this.port.toString(),
      '-c', `config_file=${configPath}`,
      '-c', 'log_statement=none',
      '-c', 'log_destination=stderr',
      '-c', 'logging_collector=off'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('PostgreSQL startup timeout (30 seconds)'));
      }, 30000);

      let hasResolved = false;

      if (pgProcess?.stdout) {
        pgProcess.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('ready to accept connections') && !hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            logInfo('PostgreSQL server started successfully');
            resolve();
          }
        });
      }

      if (pgProcess?.stderr) {
        pgProcess.stderr.on('data', (data) => {
          const output = data.toString();
          logInfo(`PostgreSQL: ${output.trim()}`);

          if (output.includes('ready to accept connections') && !hasResolved) {
            hasResolved = true;
            clearTimeout(timeout);
            logInfo('PostgreSQL server started successfully');
            resolve();
          }
        });
      }

      pgProcess?.on('error', (error) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      pgProcess?.on('exit', (code, signal) => {
        if (!hasResolved) {
          hasResolved = true;
          clearTimeout(timeout);
          reject(new Error(`PostgreSQL process exited with code ${code}, signal ${signal}`));
        } else {
          logInfo(`PostgreSQL process exited with code ${code}, signal ${signal}`);
          pgProcess = null;
        }
      });
    });
  }

  async stopServer(): Promise<void> {
    if (pgProcess && !pgProcess.killed) {
      logInfo('Stopping PostgreSQL server...');

      pgProcess.kill('SIGTERM');

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (pgProcess && !pgProcess.killed) {
            logWarn('PostgreSQL did not stop gracefully, forcing shutdown');
            pgProcess.kill('SIGKILL');
          }
          pgProcess = null;
          resolve();
        }, 5000);

        pgProcess?.on('exit', () => {
          clearTimeout(timeout);
          pgProcess = null;
          logInfo('PostgreSQL server stopped');
          resolve();
        });
      });
    }
  }

  private getPgPath(): string {
    const executable = process.platform === 'win32' ? 'postgres.exe' : 'postgres';

    const possiblePaths = [
      path.join(this.binDir, executable),
      path.join(this.postgresDir, 'pgsql', executable),
      path.join(this.postgresDir, 'pgsql', 'bin', executable)
    ];

    for (const execPath of possiblePaths) {
      try {
        require('node:fs').accessSync(execPath);
        return execPath;
      } catch {
        continue;
      }
    }

    return path.join(this.binDir, executable);
  }

  private getPgCtlPath(): string {
    const executable = process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl';

    const possiblePaths = [
      path.join(this.binDir, executable),
      path.join(this.postgresDir, 'pgsql', executable),
      path.join(this.postgresDir, 'pgsql', 'bin', executable)
    ];

    for (const execPath of possiblePaths) {
      try {
        require('node:fs').accessSync(execPath);
        return execPath;
      } catch {
        continue;
      }
    }

    return path.join(this.binDir, executable);
  }

  private getInitdbPath(): string {
    const executable = process.platform === 'win32' ? 'initdb.exe' : 'initdb';

    const possiblePaths = [
      path.join(this.binDir, executable),
      path.join(this.postgresDir, 'pgsql', executable),
      path.join(this.postgresDir, 'pgsql', 'bin', executable)
    ];

    for (const execPath of possiblePaths) {
      try {
        require('node:fs').accessSync(execPath);
        return execPath;
      } catch {
        continue;
      }
    }

    return path.join(this.binDir, executable);
  }

  private async createPostgresConfig(): Promise<string> {
    const configPath = path.join(this.dataDir, 'postgresql.conf');

    const config = `
# Basic configuration for embedded PostgreSQL
port = ${this.port}
max_connections = 100
shared_buffers = 128MB
dynamic_shared_memory_type = posix
max_wal_size = 1GB
min_wal_size = 80MB
log_timezone = 'UTC'
datestyle = 'iso, mdy'
timezone = 'UTC'
lc_messages = 'en_US.UTF-8'
lc_monetary = 'en_US.UTF-8'
lc_numeric = 'en_US.UTF-8'
lc_time = 'en_US.UTF-8'
default_text_search_config = 'pg_catalog.english'

# Logging configuration
log_min_messages = warning
log_min_error_statement = error
log_min_duration_statement = -1
log_checkpoints = off
log_connections = off
log_disconnections = off
log_lock_waits = off
log_statement = 'none'
`;

    await fs.writeFile(configPath, config);
    return configPath;
  }

  async createDatabase(name: string = DB_NAME): Promise<void> {
    // GUARD: Cluster must be running for performing database operations
    if (!pgProcess) {
      throw new Error('Your cluster must be running before you can create a database');
    }

    // Get client and execute CREATE DATABASE query
    const client = this.getPgClient();

    try {
      // Note: postgres-js doesn't support identifier escaping in template literals for CREATE DATABASE
      // We need to validate the name and use string concatenation carefully
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        throw new Error('Database name contains invalid characters');
      }

      await client.unsafe(`CREATE DATABASE ${name}`);
      logInfo(`Database ${name} created successfully`);
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        logInfo(`Database ${name} already exists`);
      } else {
        logError(`Database creation failed: ${error.message}`);
        throw error;
      }
    } finally {
      // Clean up client
      await client.end();
    }
  }

  private getCreatedbPath(): string {
    const executable = process.platform === 'win32' ? 'createdb.exe' : 'createdb';

    const possiblePaths = [
      path.join(this.binDir, executable),
      path.join(this.postgresDir, 'pgsql', executable),
      path.join(this.postgresDir, 'pgsql', 'bin', executable)
    ];

    for (const execPath of possiblePaths) {
      try {
        require('node:fs').accessSync(execPath);
        return execPath;
      } catch {
        continue;
      }
    }

    return path.join(this.binDir, executable);
  }

  private async downloadFile(url: string, retries = 3): Promise<Buffer> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logInfo(`Download attempt ${attempt}/${retries} for ${url}`);

        let buffer: Buffer;
        if (attempt <= 2) {
          buffer = await this.downloadFileWithHttps(url, 60000);
        } else {
          logInfo('Falling back to curl for download...');
          buffer = await this.downloadFileWithCurl(url);
        }

        logInfo(`Download successful on attempt ${attempt}`);
        return buffer;
      } catch (error) {
        logWarn(`Download attempt ${attempt} failed: ${error}`);

        if (attempt === retries) {
          throw new Error(`Failed to download after ${retries} attempts: ${error}`);
        }

        const delay = Math.pow(2, attempt - 1) * 1000;
        logInfo(`Retrying download in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unexpected error in download retry logic');
  }

  private async downloadFileWithCurl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const curl = spawn('curl', [
        '-L',
        '--fail',
        '--silent',
        '--show-error',
        '--max-time', '120',
        '--user-agent', 'Mozilla/5.0 (compatible; PostgreSQL-Manager/1.0)',
        url
      ], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const chunks: Buffer[] = [];
      let errorOutput = '';

      curl.stdout?.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      curl.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      curl.on('close', (code) => {
        if (code === 0) {
          const buffer = Buffer.concat(chunks);
          logInfo(`Downloaded ${Math.round(buffer.length / 1024 / 1024)}MB with curl`);
          resolve(buffer);
        } else {
          reject(new Error(`curl failed with code ${code}: ${errorOutput}`));
        }
      });

      curl.on('error', (error) => {
        reject(new Error(`Failed to start curl: ${error.message}`));
      });
    });
  }

  private async downloadFileWithHttps(url: string, timeoutMs: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Download timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      const request = https.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PostgreSQL-Manager/1.0)'
        }
      }, (response) => {
        clearTimeout(timeout);

        if (response.statusCode === 302 || response.statusCode === 301) {
          const redirectUrl = response.headers.location; if (redirectUrl) {
            this.downloadFileWithHttps(redirectUrl, timeoutMs).then(resolve).catch(reject);
            return;
          }
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const chunks: Buffer[] = [];
        let downloadedBytes = 0;
        const totalBytes = Number.parseInt(response.headers['content-length'] || '0', 10);

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          downloadedBytes += chunk.length;

          if (totalBytes > 0) {
            const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            if (downloadedBytes % (1024 * 1024) < chunk.length) { // Log every MB
              logInfo(`Download progress: ${progress}% (${Math.round(downloadedBytes / 1024 / 1024)}MB / ${Math.round(totalBytes / 1024 / 1024)}MB)`);
            }
          }
        });

        response.on('end', () => {
          logInfo(`Download completed: ${Math.round(downloadedBytes / 1024 / 1024)}MB`);
          resolve(Buffer.concat(chunks));
        });

        response.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      request.on('timeout', () => {
        clearTimeout(timeout);
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  private async extractPostgresBinaries(jarBuffer: Buffer): Promise<void> {
    const unpackedJar = new AdmZip(jarBuffer);
    const jarEntries = unpackedJar.getEntries();
    const archive = jarEntries.find((f) => f.entryName.endsWith('txz'));

    if (!archive) {
      throw new Error('Could not find archive containing binaries in JAR file');
    }

    const data = archive.getData();
    const nativeTxzPath = path.join(this.postgresDir, 'native.txz');
    const nativeDir = path.join(this.postgresDir, 'native');

    await fs.rm(nativeDir, { recursive: true }).catch(() => '');
    await fs.mkdir(nativeDir, { recursive: true });
    await fs.writeFile(nativeTxzPath, data);

    try {
      if (process.platform === 'darwin') {
        if (this.hasBinary(['tar'])) {
          await this.extractWithMacOSTar(nativeTxzPath, nativeDir);
        } else {
          await this.extractWithJsTar(nativeTxzPath, nativeDir);
        }
      } else if (process.platform === 'linux') {
        if (this.hasBinary(['tar', 'xz'])) {
          await this.extractWithNativeTar(nativeTxzPath, nativeDir);
        } else if (this.hasBinary(['7z'])) {
          await this.extractWith7zip(nativeTxzPath, nativeDir);
        } else {
          await this.extractWithJsTar(nativeTxzPath, nativeDir);
        }
      } else {
        if (this.hasBinary(['7z'])) {
          await this.extractWith7zip(nativeTxzPath, nativeDir);
        } else {
          await this.extractWithJsTar(nativeTxzPath, nativeDir);
        }
      }

      await this.moveExtractedFiles(nativeDir);

    } finally {
      await fs.unlink(nativeTxzPath).catch(() => { });
      await fs.rm(nativeDir, { recursive: true }).catch(() => { });
    }
  }

  private async extractWithMacOSTar(txzPath: string, outputDir: string): Promise<void> {
    logInfo('Extracting with macOS native tar...');

    return new Promise((resolve, reject) => {
      const tarProcess = spawn('tar', ['-xf', txzPath, '-C', outputDir], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let errorOutput = '';

      tarProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      tarProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to extract with macOS tar: ${errorOutput}`));
        } else {
          logInfo('Successfully extracted with macOS tar');
          resolve();
        }
      });

      tarProcess.on('error', (error) => {
        reject(new Error(`Failed to start tar process: ${error.message}`));
      });
    });
  }

  private async extractWithNativeTar(txzPath: string, outputDir: string): Promise<void> {
    logInfo('Extracting with native tar and xz...');

    return new Promise((resolve, reject) => {
      const tarProcess = spawn('tar', ['-xJf', txzPath, '-C', outputDir], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let errorOutput = '';

      tarProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      tarProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to extract with native tar: ${errorOutput}`));
        } else {
          logInfo('Successfully extracted with native tar');
          resolve();
        }
      });

      tarProcess.on('error', (error) => {
        reject(new Error(`Failed to start tar process: ${error.message}`));
      });
    });
  }

  private async extractWith7zip(txzPath: string, outputDir: string): Promise<void> {
    logInfo('Extracting with 7zip...');

    return new Promise((resolve, reject) => {
      const p7zip1 = spawn('7z', ['x', txzPath, '-so'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      const p7zip2 = spawn('7z', ['x', '-si', '-ttar', `-o${outputDir}`], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let errorOutput = '';

      p7zip1.stdout?.pipe(p7zip2.stdin as any);

      p7zip1.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      p7zip2.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      p7zip2.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to extract with 7zip: ${errorOutput}`));
        } else {
          logInfo('Successfully extracted with 7zip');
          resolve();
        }
      });

      p7zip1.on('error', (error) => {
        reject(new Error(`Failed to start first 7zip process: ${error.message}`));
      });

      p7zip2.on('error', (error) => {
        reject(new Error(`Failed to start second 7zip process: ${error.message}`));
      });
    });
  }

  private async extractWithJsTar(txzPath: string, outputDir: string): Promise<void> {
    logInfo('Extracting with JavaScript tar library...');

    try {
      // Read the .txz file and extract it
      const txzData = await fs.readFile(txzPath);

      // Use the tar library to extract
      await tar.extract({
        file: txzPath,
        cwd: outputDir,
        strip: 0
      });

      logInfo('Successfully extracted with JavaScript tar library');
    } catch (error) {
      throw new Error(`Failed to extract with JavaScript tar: ${error}`);
    }
  }

  private hasBinary(bin: string | string[]): boolean {
    const whichCommand = os.platform() === 'win32' ? 'where' : 'which';

    return (Array.isArray(bin) ? bin : [bin])
      .every((name) => {
        try {
          const output = spawnSync(whichCommand, [name], {
            stdio: 'pipe',
            shell: process.platform === 'win32' // Only use shell on Windows
          });
          return output.status === 0;
        } catch (error) {
          logWarn(`Failed to check for binary ${name}: ${error}`);
          return false;
        }
      });
  }

  private async moveExtractedFiles(nativeDir: string): Promise<void> {
    const items = await fs.readdir(nativeDir);
    logInfo(`Extracted items in ${nativeDir}: ${items.join(', ')}`);

    const pgSqlDir = path.join(this.postgresDir, 'pgsql');

    await fs.rm(pgSqlDir, { recursive: true }).catch(() => { });
    await fs.mkdir(pgSqlDir, { recursive: true });

    for (const item of items) {
      const srcPath = path.join(nativeDir, item);
      const destPath = path.join(pgSqlDir, item);

      try {
        await fs.rename(srcPath, destPath);
        logInfo(`Moved ${item} to PostgreSQL directory`);
      } catch (error) {
        logError(`Failed to move ${item}: ${error}`);
        try {
          const stat = await fs.stat(srcPath);
          if (stat.isDirectory()) {
            await this.copyDirectory(srcPath, destPath);
          } else {
            await fs.copyFile(srcPath, destPath);
          }
          logInfo(`Copied ${item} to PostgreSQL directory as fallback`);
        } catch (copyError) {
          logError(`Failed to copy ${item}: ${copyError}`);
          throw copyError;
        }
      }
    }

    logInfo('All PostgreSQL files moved to final location');
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const items = await fs.readdir(src);

    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      const stat = await fs.stat(srcPath);

      if (stat.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private getPgClient() {
    return postgres({
      host: 'localhost',
      port: this.port,
      username: 'postgres',
      database: 'postgres', // Connect to the default postgres database
      // No password needed since we configured trust authentication
    });
  }

}

let postgresManager: PortablePostgresManager | null = null;

export async function startPostgresServer(port = 5434): Promise<void> {
  if (!postgresManager) {
    postgresManager = new PortablePostgresManager(port);
  }

  await postgresManager.startServer();

  try {
    await postgresManager.createDatabase();
  } catch (error) {
    logWarn(`Could not create database, it may already exist: ${error}`);
  }
}

export async function stopPostgresServer(): Promise<void> {
  if (postgresManager) {
    await postgresManager.stopServer();
  }
}