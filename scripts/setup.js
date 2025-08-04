const path = require('node:path');

console.log('🚀 Starting NeutralBase setup...\n');

try {
  const SetupManager = require('./setup-interactive.js');
  const setupManager = new SetupManager();
  setupManager.run();
} catch (error) {
  console.error('❌ Setup failed:', error.message);
  console.log('\n💡 Fallback: Running basic binary setup only...\n');

  const fs = require('node:fs');

  function setupBinaries() {
    const binariesDir = path.join(__dirname, '..', 'resources', 'binaries');

    if (!fs.existsSync(binariesDir)) {
      console.log('No binaries directory found, skipping setup...');
      return;
    }

    function makeExecutable(dir) {
      const items = fs.readdirSync(dir);

      items.forEach(item => {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          makeExecutable(itemPath);
        } else if (stat.isFile()) {
          if (item.includes('redis-') || item.includes('server') || !path.extname(item)) {
            try {
              fs.chmodSync(itemPath, 0o755);
              console.log(`Made executable: ${itemPath}`);
            } catch (error) {
              console.warn(`Warning: Could not make ${itemPath} executable:`, error.message);
            }
          }
        }
      });
    }

    try {
      makeExecutable(binariesDir);
      console.log('✅ Binary setup completed successfully!');
      console.log('\n📝 Please manually:');
      console.log('1. Copy .env.example to .env and configure your environment variables');
      console.log('2. Run: pnpm db:start');
      console.log('3. Run: pnpm db:push');
      console.log('4. Run: pnpm dev');
    } catch (error) {
      console.error('❌ Error setting up binaries:', error);
    }
  }

  setupBinaries();
}