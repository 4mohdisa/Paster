#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');


const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  bright: '\x1b[1m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
};

class SetupValidator {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.envPath = path.join(this.projectRoot, '.env');
    this.binariesDir = path.join(this.projectRoot, 'resources', 'binaries');
    this.errors = [];
    this.warnings = [];
  }

  validate() {
    console.log(`\n${colors.bright}🔍 Validating NeutralBase Setup${colors.reset}\n`);

    this.checkEnvironmentFile();
    this.checkRequiredEnvVars();
    this.checkBinaryPermissions();
    this.checkDependencies();
    this.checkDatabaseConnection();

    this.printSummary();
  }

  checkEnvironmentFile() {
    if (fs.existsSync(this.envPath)) {
      log.success('Environment file (.env) exists');
    } else {
      this.errors.push('Environment file (.env) is missing');
      log.error('Environment file (.env) is missing');
      log.info('Run: pnpm setup to create it');
    }
  }

  checkRequiredEnvVars() {
    if (!fs.existsSync(this.envPath)) {
      return;
    }

    const envContent = fs.readFileSync(this.envPath, 'utf8');
    const envVars = this.parseEnvFile(envContent);

    const requiredVars = ['AUTH_SECRET', 'POSTGRES_URL'];
    const recommendedVars = ['XAI_API_KEY'];

    for (const varName of requiredVars) {
      if (envVars[varName] && envVars[varName] !== '***') {
        log.success(`${varName} is configured`);
      } else {
        this.errors.push(`${varName} is not configured`);
        log.error(`${varName} is not configured`);
      }
    }

    for (const varName of recommendedVars) {
      if (envVars[varName] && envVars[varName] !== '***') {
        log.success(`${varName} is configured`);
      } else {
        this.warnings.push(`${varName} is not configured (recommended for AI features)`);
        log.warn(`${varName} is not configured (recommended for AI features)`);
      }
    }
  }

  parseEnvFile(content) {
    const env = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    }

    return env;
  }

  checkBinaryPermissions() {
    if (!fs.existsSync(this.binariesDir)) {
      log.warn('Binaries directory not found - this is normal for some setups');
      return;
    }

    const hasExecutableFiles = this.checkExecutableFilesRecursive(this.binariesDir);

    if (hasExecutableFiles) {
      log.success('Binary files have correct permissions');
    } else {
      this.warnings.push('No executable binary files found');
      log.warn('No executable binary files found');
    }
  }

  checkExecutableFilesRecursive(dir) {
    const items = fs.readdirSync(dir);
    let hasExecutable = false;

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        hasExecutable = this.checkExecutableFilesRecursive(itemPath) || hasExecutable;
      } else if (stat.isFile()) {
        if (item.includes('redis-') || item.includes('server') || !path.extname(item)) {
          const mode = stat.mode;
          const isExecutable = (mode & 0o100) !== 0;
          if (isExecutable) {
            hasExecutable = true;
          }
        }
      }
    }

    return hasExecutable;
  }

  checkDependencies() {
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const nodeModulesPath = path.join(this.projectRoot, 'node_modules');

    if (fs.existsSync(nodeModulesPath)) {
      log.success('Dependencies are installed');
    } else {
      this.errors.push('Dependencies are not installed');
      log.error('Dependencies are not installed');
      log.info('Run: pnpm install');
    }

    // Check if lockfile exists
    const lockfilePath = path.join(this.projectRoot, 'pnpm-lock.yaml');
    if (fs.existsSync(lockfilePath)) {
      log.success('Lockfile exists (pnpm-lock.yaml)');
    } else {
      this.warnings.push('Lockfile missing - dependencies might not be consistent');
      log.warn('Lockfile missing - dependencies might not be consistent');
    }
  }

  checkDatabaseConnection() {
    const migrationsDir = path.join(this.projectRoot, 'src', 'lib', 'db', 'migrations');

    if (fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0) {
      log.success('Database migrations exist');
    } else {
      this.warnings.push('No database migrations found');
      log.warn('No database migrations found');
      log.info('Run: pnpm db:generate to create them');
    }
  }

  printSummary() {
    console.log(`\n${colors.bright}📋 Setup Validation Summary${colors.reset}\n`);

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(`${colors.green}🎉 All checks passed! Your setup looks good.${colors.reset}`);
      console.log(`\n${colors.bright}Next steps:${colors.reset}`);
      console.log(`  ${colors.blue}•${colors.reset} Run ${colors.yellow}pnpm dev${colors.reset} to start development`);
      console.log(`  ${colors.blue}•${colors.reset} Run ${colors.yellow}pnpm db:studio${colors.reset} to manage your database`);
    } else {
      if (this.errors.length > 0) {
        console.log(`${colors.red}❌ ${this.errors.length} error(s) found:${colors.reset}`);
        this.errors.forEach(error => console.log(`   • ${error}`));
        console.log();
      }

      if (this.warnings.length > 0) {
        console.log(`${colors.yellow}⚠️  ${this.warnings.length} warning(s):${colors.reset}`);
        this.warnings.forEach(warning => console.log(`   • ${warning}`));
        console.log();
      }

      if (this.errors.length > 0) {
        console.log(`${colors.red}🔧 Please fix the errors above before proceeding.${colors.reset}`);
        console.log(`${colors.blue}💡 Run ${colors.yellow}pnpm setup${colors.reset} to reconfigure your setup.`);
      } else {
        console.log(`${colors.green}✅ No critical errors found. You can proceed with development.${colors.reset}`);
        console.log(`${colors.blue}💡 Consider addressing the warnings above for the best experience.${colors.reset}`);
      }
    }

    console.log();
    return this.errors.length === 0;
  }
}

if (require.main === module) {
  const validator = new SetupValidator();
  const isValid = validator.validate();
  process.exit(isValid ? 0 : 1);
}

module.exports = SetupValidator;
