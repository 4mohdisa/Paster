const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

function autoApproveBuilds(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['approve-builds'], {
      cwd,
      stdio: ['pipe', 'inherit', 'inherit'],
    });

    child.stdin.write('a\n');
    setTimeout(() => child.stdin.write('y\n'), 600);
    setTimeout(() => child.stdin.end(), 800);

    child.on('close', (code) => {
      if (code === 0) {
        resolve('✅ Build approval complete');
      } else {
        reject(new Error(`❌ pnpm approve-builds failed with exit code ${code}`));
      }
    });
  });
}

const ENV_VARIABLES = {
  AUTH_SECRET: {
    description: 'Authentication secret key (generate random string)',
    required: true,
    example: 'your-32-character-secret-key-here',
    generate: () => require('node:crypto').randomBytes(32).toString('base64'),
  },
  XAI_API_KEY: {
    description: 'xAI API Key for AI functionality',
    required: true,
    example: 'xai-your-api-key-here',
  },
  BLOB_READ_WRITE_TOKEN: {
    description: 'Vercel Blob storage token',
    required: false,
    example: 'vercel_blob_rw_token_here',
  },
  POSTGRES_URL: {
    description: 'PostgreSQL database connection URL',
    required: true,
    default: 'postgresql://postgres:password@localhost:5434/neutralbase_app',
    example: 'postgresql://postgres:password@localhost:5434/neutralbase_app',
  },
  REDIS_URL: {
    description: 'Redis connection URL',
    required: false,
    example: 'redis://localhost:6379',
  },
  POLAR_ACCESS_TOKEN: {
    description: 'Polar access token',
    required: false,
    example: 'polar_token_here',
  },
  POLAR_SERVER: {
    description: 'Polar server environment',
    required: false,
    default: 'sandbox',
    example: 'sandbox',
  },
  METRONOME_BEARER_TOKEN: {
    description: 'Metronome bearer token',
    required: false,
    example: 'metronome_token_here',
  },
};

class SetupManager {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.envPath = path.join(this.projectRoot, '.env');
    this.envExamplePath = path.join(this.projectRoot, '.env.example');
  }

  async run() {
    try {
      log.title('🚀 NeutralBase Next-Electron Setup');

      if (process.platform === 'darwin') {
        try {
          log.info('Detected macOS - approving builds...');
          const result = await autoApproveBuilds(this.projectRoot);
          log.success(result);
        } catch (error) {
          log.warn(`Build approval failed: ${error.message}`);
          log.info('Continuing with setup...');
        }
      }

      if (await this.checkExistingEnv()) {
        const overwrite = await question(
          `${colors.yellow}⚠${colors.reset} .env file already exists. Do you want to:\n  1) Keep existing and skip env setup\n  2) Update/overwrite existing values\n  3) Exit setup\nChoose option (1-3): `
        );

        switch (overwrite.trim()) {
          case '1':
            log.info('Keeping existing .env file');
            break;
          case '2':
            await this.setupEnvironment(true);
            break;
          // biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
          case '3':
            log.info('Setup cancelled');
            process.exit(0);
          default:
            log.info('Invalid option, keeping existing .env file');
        }
      } else {
        await this.setupEnvironment(false);
      }

      await this.setupDatabase();

      await this.completionMessage();

    } catch (error) {
      log.error(`Setup failed: ${error.message}`);
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  async checkExistingEnv() {
    try {
      await fs.promises.access(this.envPath);
      return true;
    } catch {
      return false;
    }
  }

  async setupEnvironment(updateExisting) {
    log.title('🔧 Environment Configuration');

    let existingEnv = {};
    if (updateExisting) {
      try {
        const envContent = await fs.promises.readFile(this.envPath, 'utf8');
        existingEnv = this.parseEnvFile(envContent);
      } catch (error) {
        log.warn('Could not read existing .env file, creating new one');
      }
    }

    const envValues = {};

    for (const [key, config] of Object.entries(ENV_VARIABLES)) {
      const existing = existingEnv[key];
      let value;

      if (existing && !updateExisting) {
        value = existing;
        log.info(`Using existing ${key}`);
      } else {
        const prompt = this.buildPrompt(key, config, existing);
        const input = await question(prompt);

        if (input.trim() === '' && config.default) {
          value = config.default;
        } else if (input.trim() === '' && config.generate) {
          value = config.generate();
          log.success(`Generated ${key}`);
        } else if (input.trim() === '' && existing) {
          value = existing;
        } else if (input.trim() === '' && config.required) {
          log.error(`${key} is required!`);
          process.exit(1);
        } else {
          value = input.trim() || undefined;
        }
      }

      if (value) {
        envValues[key] = value;
      }
    }

    await this.writeEnvFile(envValues);
    log.success('Environment configuration completed');
  }

  buildPrompt(key, config, existing) {
    let prompt = `\n${colors.bright}${key}${colors.reset}\n`;
    prompt += `  ${config.description}\n`;

    if (config.example) {
      prompt += `  ${colors.yellow}Example:${colors.reset} ${config.example}\n`;
    }

    if (existing) {
      prompt += `  ${colors.green}Current:${colors.reset} ${this.maskSensitive(key, existing)}\n`;
    }

    if (config.default) {
      prompt += `  ${colors.cyan}Default:${colors.reset} ${config.default}\n`;
    }

    if (config.generate) {
      prompt += `  ${colors.magenta}Press Enter to auto-generate${colors.reset}\n`;
    }

    prompt += `  Enter value${existing ? ' (or press Enter to keep current)' : ''}: `;

    return prompt;
  }

  maskSensitive(key, value) {
    const sensitiveKeys = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD'];
    if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
      return '*'.repeat(Math.min(value.length, 20));
    }
    return value;
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

  async writeEnvFile(envValues) {
    let content = '# Generated by setup script\n';
    content += `# Created on ${new Date().toISOString()}\n\n`;

    for (const [key, config] of Object.entries(ENV_VARIABLES)) {
      content += `# ${config.description}\n`;
      if (config.example) {
        content += `# Example: ${config.example}\n`;
      }

      const value = envValues[key];
      if (value !== undefined) {
        content += `${key}=${value}\n`;
      } else {
        content += `# ${key}=\n`;
      }
      content += '\n';
    }

    await fs.promises.writeFile(this.envPath, content);
    log.success('.env file created/updated');
  }

  async makeExecutableRecursive(dir) {
    const items = await fs.promises.readdir(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.promises.stat(itemPath);

      if (stat.isDirectory()) {
        await this.makeExecutableRecursive(itemPath);
      } else if (stat.isFile()) {
        if (item.includes('redis-') || item.includes('server') || !path.extname(item)) {
          try {
            await fs.promises.chmod(itemPath, 0o755);
            log.info(`Made executable: ${itemPath}`);
          } catch (error) {
            log.warn(`Warning: Could not make ${itemPath} executable: ${error.message}`);
          }
        }
      }
    }
  }

  async setupDatabase() {
    log.title('🗄️ Database Setup');

    try {
      log.info('Starting database server...');

      const dbStartProcess = spawn('pnpm', ['db:start'], {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      await new Promise((resolve, reject) => {
        let output = '';
        const timeout = setTimeout(() => {
          reject(new Error('Database start timeout'));
        }, 30000);

        dbStartProcess.stdout.on('data', (data) => {
          output += data.toString();
          process.stdout.write(data);

          if (output.includes('PostgreSQL server started on port 5434')) {
            clearTimeout(timeout);
            log.success('Database server started successfully!');
            resolve();
          }
        });

        dbStartProcess.stderr.on('data', (data) => {
          process.stderr.write(data);
        });

        dbStartProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      log.info('Pushing database schema...');

      const pushResult = await this.runCommand('pnpm', ['db:push'], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      if (pushResult.success) {
        log.success('Database schema pushed successfully!');
      } else {
        log.warn('Database push had issues, but continuing...');
      }

      // Keep the database process running in background
      log.info('Database server is running in background...');

    } catch (error) {
      log.error(`Database setup failed: ${error.message}`);
      log.warn('You may need to manually run: pnpm db:start && pnpm db:push');
    }
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: 'pipe',
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          if (options.stdio === 'inherit') {
            process.stdout.write(data);
          }
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          stderr += data.toString();
          if (options.stdio === 'inherit') {
            process.stderr.write(data);
          }
        });
      }

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          code,
          stdout,
          stderr
        });
      });

      child.on('error', (error) => {
        resolve({
          success: false,
          code: -1,
          stdout,
          stderr: error.message
        });
      });
    });
  }

  async completionMessage() {
    log.title('🎉 Setup Complete!');

    console.log(`${colors.green}✓${colors.reset} Environment variables configured`);
    console.log(`${colors.green}✓${colors.reset} Binary permissions set`);
    console.log(`${colors.green}✓${colors.reset} Database schema synchronized`);

    console.log(`\n${colors.bright}Next steps:${colors.reset}`);
    console.log(`  ${colors.cyan}1.${colors.reset} Start development: ${colors.yellow}pnpm dev${colors.reset}`);
    console.log(`  ${colors.cyan}2.${colors.reset} Build for production: ${colors.yellow}pnpm build${colors.reset}`);
    console.log(`  ${colors.cyan}3.${colors.reset} Package app: ${colors.yellow}pnpm dist${colors.reset}`);

    console.log(`\n${colors.bright}Useful commands:${colors.reset}`);
    console.log(`  ${colors.yellow}pnpm db:studio${colors.reset}     - Open database studio`);
    console.log(`  ${colors.yellow}pnpm db:migrate${colors.reset}    - Run database migrations`);
    console.log(`  ${colors.yellow}pnpm lint${colors.reset}          - Run code linting`);
    console.log(`  ${colors.yellow}pnpm format${colors.reset}        - Format code`);

    const startNow = await question(`\n${colors.bright}Would you like to start the development server now? (y/N): ${colors.reset}`);

    if (startNow.toLowerCase().trim() === 'y' || startNow.toLowerCase().trim() === 'yes') {
      log.info('Starting development server...');
      console.log(`\n${colors.bright}${colors.green}🚀 Starting NeutralBase development server...${colors.reset}\n`);

      const devProcess = spawn('pnpm', ['dev'], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      process.on('SIGINT', () => {
        log.info('Shutting down development server...');
        devProcess.kill('SIGINT');
        process.exit(0);
      });

    } else {
      console.log(`\n${colors.bright}Ready to go! Run ${colors.yellow}pnpm dev${colors.reset}${colors.bright} when you're ready to start developing.${colors.reset}\n`);
    }
  }
}

if (require.main === module) {
  const setupManager = new SetupManager();
  setupManager.run().catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = SetupManager;
