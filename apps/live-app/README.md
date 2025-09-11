# 🚀 Electron + React + Tailwind CSS Template

A modern, production-ready template for building cross-platform desktop applications with Electron, React 19, TypeScript, and Tailwind CSS v4.

## ✨ Features

- **⚡ Electron 37** - Latest stable version with modern APIs
- **⚛️ React 19** - Latest React with concurrent features
- **🎨 Tailwind CSS v4** - Latest version with improved performance
- **📝 TypeScript** - Full type safety and better developer experience
- **🔧 Electron Forge** - Complete build and packaging solution
- **📦 Webpack** - Optimized bundling with hot reload
- **🎯 ESLint** - Code quality and consistency
- **📱 Cross-platform** - Build for Windows, macOS, and Linux

## 🛠️ Tech Stack

- **Electron**: 37.2.0
- **React**: 19.1.0
- **TypeScript**: 4.5.4
- **Tailwind CSS**: 4.1.11
- **Electron Forge**: 7.8.1
- **Webpack**: Latest with optimized configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the template**
   ```bash
   git clone https://github.com/Mohammed-Yasin-Mulla/Electron-Tailwindv4-React-Template.git
   cd Electron-Tailwindv4-React-Template
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

## 📁 Project Structure

```
├── src/
│   ├── App.tsx              # Main React component
│   ├── index.css            # Tailwind CSS imports
│   ├── index.html           # HTML shell
│   ├── renderer.ts          # Electron renderer entry
│   ├── main.ts              # Electron main process
│   └── preload.ts           # Preload scripts
├── webpack.*.ts             # Webpack configurations
├── forge.config.ts          # Electron Forge config
├── tsconfig.json            # TypeScript config
├── postcss.config.mjs       # PostCSS config for Tailwind
└── package.json             # Dependencies and scripts
```

## 🎯 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server with hot reload |
| `npm run package` | Package the app for distribution |
| `npm run make` | Create distributables for all platforms |
| `npm run publish` | Build and publish to distribution platforms |
| `npm run lint` | Run ESLint for code quality |

## 🎨 Styling with Tailwind CSS

This template uses **Tailwind CSS v4** with the new `@import "tailwindcss"` syntax:

```css
/* src/index.css */
@import "tailwindcss";

/* Your custom styles here */
```

### Example Component

```tsx
import React from 'react';

const MyComponent: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Hello Electron + React + Tailwind!
        </h1>
        <button className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors">
          Click me!
        </button>
      </div>
    </div>
  );
};
```

## 🛡️ Type-Safe Preload API

This template provides **complete type safety** when accessing Electron preload methods from your React components. No more `any` types or runtime errors!

### How It Works

The template implements a robust type safety system:

1. **Single Source of Truth**: All API types are defined in `src/types/electron-api.ts`
2. **Preload Bridge**: `src/preload.ts` exposes typed methods via `contextBridge`
3. **Global Types**: `src/types/electron.d.ts` extends the Window interface
4. **Full IntelliSense**: Get autocomplete and type checking in your React components

### Example Usage

```tsx
// ✅ Fully typed - IntelliSense works!
const isDesktop = window.electronAPI.desktop;
const isMobile = window.electronAPI.mobile;
const isTablet = window.electronAPI.tablet;

// ✅ TypeScript will catch errors at compile time
// window.electronAPI.nonExistentMethod; // ❌ TypeScript error
```

### Adding New API Methods

1. **Define the interface** in `src/types/electron-api.ts`:
   ```ts
   export interface ElectronAPI {
     desktop: boolean;
     mobile: boolean;
     tablet: boolean;
     // Add your new methods here
     openFile: () => Promise<string>;
     saveData: (data: string) => Promise<void>;
   }
   ```

2. **Implement in preload** in `src/preload.ts`:
   ```ts
   const electronAPI: ElectronAPI = {
     desktop: true,
     mobile: false,
     tablet: false,
     openFile: async () => {
       // Your implementation
       return "file-path";
     },
     saveData: async (data: string) => {
       // Your implementation
     }
   };
   ```

3. **Use in React** with full type safety:
   ```tsx
   const handleOpenFile = async () => {
     const filePath = await window.electronAPI.openFile(); // ✅ Typed!
     // TypeScript knows filePath is a string
   };
   ```

## 🔧 Configuration

### Electron Forge

The template includes pre-configured makers for all major platforms:

- **Windows**: Squirrel installer
- **macOS**: DMG and ZIP
- **Linux**: DEB and RPM packages

### TypeScript

Full TypeScript support with strict mode enabled and React JSX support.

### Webpack

Optimized webpack configuration with:
- Hot module replacement
- TypeScript compilation
- CSS processing with PostCSS
- Asset optimization

## 📦 Building for Production

### Create Distributables

```bash
# Build for current platform
npm run make

# Build for specific platform
npm run make -- --targets=@electron-forge/maker-zip
```

### Available Targets

- `@electron-forge/maker-zip` - Cross-platform ZIP
- `@electron-forge/maker-squirrel` - Windows installer
- `@electron-forge/maker-deb` - Linux DEB package
- `@electron-forge/maker-rpm` - Linux RPM package

## 🚀 Deployment

### Publishing

```bash
npm run publish
```

Configure publishers in `forge.config.ts` for:
- GitHub Releases
- S3
- Custom servers

## 🐛 Troubleshooting

### Common Issues

1. **EPIPE Error**: This is a known issue with `fork-ts-checker-webpack-plugin`. The template uses `transpileOnly: true` to avoid this.

2. **Build Errors**: Clear build cache:
   ```bash
   rm -rf .webpack out node_modules
   npm install
   ```

3. **TypeScript Errors**: Run type checking separately:
   ```bash
   npx tsc --noEmit
   ```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License 

## 🙏 Acknowledgments

- [Electron](https://electronjs.org/) - Cross-platform desktop apps
- [React](https://reactjs.org/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Electron Forge](https://www.electronforge.io/) - Build tooling

## 📞 Support

If you have any questions or need help:

- 🐛 Issues: [GitHub Issues](https://github.com/Mohammed-Yasin-Mulla/Electron-Tailwindv4-React-Template/issues)


---

⭐ **Star this repository if you find it helpful!** 