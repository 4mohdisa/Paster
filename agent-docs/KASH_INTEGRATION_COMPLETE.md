# Kash Integration - Complete Implementation Guide

## Overview
This document details the complete Kash integration into AiPaste, covering the journey from initial implementation to working DOCX conversion with proper action architecture.

## Architecture Components

### 1. Python Bridge (`electron/main/python-bridge.ts`)
**Purpose:** TypeScript interface to Python/Kash world

**Key Features:**
- Singleton EventEmitter pattern
- JSON protocol for IPC communication
- Lazy initialization with installation detection
- Path resolution hierarchy (User → Build-time → Fallback)

**Critical Methods:**
- `processFile()`: Single file processing with action routing
- `processFiles()`: Batch processing capability
- `checkDependencies()`: Installation verification

**Installation Detection Pattern:**
```typescript
if (!isInstalled) {
  return {
    success: false,
    needsInstallation: true,
    requiredAction: action,
    error: 'Document processing features not installed'
  };
}
```

### 2. Kash Installer (`electron/main/kash-installer.ts`)
**Purpose:** Automated Kash environment setup

**Implementation:**
- Uses `py-app-standalone` for isolated Python environment
- Downloads Python 3.11 (~40MB) if not present
- Installs Kash and required packages in `.aipaste` directory

**Key Fix:** Added `--break-system-packages` flag for py-app-standalone compatibility

**Installation Flow:**
1. Download Python via py-app-standalone
2. Install kash-shell base package
3. Install action-specific packages (python-docx, docx2txt)
4. Report progress via IPC

### 3. Ultimate Runner (`electron/resources/kash-ultimate-runner.py`)
**Purpose:** Unified execution engine for all Kash operations

**Critical Configuration (MUST BE FIRST):**
```python
kash_setup(
    rich_logging=True,  # Required for console_quiet
    console_quiet=True,  # Suppress verbose output
    console_log_level=LogLevel.error
)
```

**Custom Action Loading:**
```python
def load_custom_actions():
    for action_file in custom_actions:
        runpy.run_path(str(action_path))
    refresh_action_classes()
```

**Proper Execution Pipeline:**
```python
action_class = look_up_action_class(action)
action_instance = action_class.create(None)
runtime_settings = RuntimeSettings(workspace_dir=workspace_dir)
context = ExecContext(action=action_instance, settings=runtime_settings)
action_input = ActionInput(items=[item])
result = run_action_with_caching(context, action_input)
```

### 4. Custom Action (`electron/resources/kash_docx_action.py`)
**Purpose:** DOCX to Markdown conversion

**Final Working Signature:**
```python
@kash_action(
    name="docx_to_markdown",
    description="Convert DOCX files to Markdown format",
    output_type=ItemType.doc,
    expected_outputs=1
)
def docx_to_markdown(item: Item) -> Item:
```

**Path Resolution Pattern:**
```python
if item.external_path:
    file_path = Path(item.external_path)
elif item.store_path:
    workspace_dir = Path.home() / '.aipaste' / 'kash-workspace'
    file_path = workspace_dir / item.store_path
```

### 5. Process Manager Integration (`electron/main/process-manager.ts`)
**Purpose:** File type detection and action routing

**Smart Routing:**
```typescript
const action = getActionForFile(firstFile, enabledActions) || 'markdownify';
```

### 6. Frontend Integration

**Onboarding Flow (`apps/main-window/src/components/onboarding.tsx`):**
1. Detect Kash installation status
2. Install base Kash if missing
3. Install action packages
4. Save enabled actions configuration

**Dashboard Integration:**
- Cmd+Shift+K trigger
- File type detection
- Action execution
- Result to clipboard

## Key Learnings

### Critical Discoveries

1. **Kash Setup Timing**
   - MUST call `kash_setup()` before ANY Kash imports
   - Silent failures occur if configuration happens after imports

2. **Action Signatures**
   - Simple: `(item: Item) -> Item`
   - Regular: `(input: ActionInput, *, context: ActionContext) -> ActionResult`
   - The `*` makes following parameters keyword-only (REQUIRED!)

3. **FileStore Path Resolution**
   - Items have `store_path` (relative), not `file_path`
   - Must resolve through workspace directory
   - `external_path` for files outside workspace

4. **Proper Action Registration**
   - `runpy.run_path()` executes action files
   - `@kash_action` decorator auto-registers
   - `refresh_action_classes()` updates registry
   - This is the OFFICIAL Kash pattern

5. **Execution Pipeline**
   - Never call action methods directly
   - Use `run_action_with_caching()` for full benefits
   - Returns `ResultWithPaths` object, not tuple

### Import Corrections

**Wrong:** `from kash.exec.action_registry import ActionRegistry`  
**Right:** `from kash.exec.action_registry import look_up_action_class, refresh_action_classes`

**Wrong:** `from kash.model import ExecContext`  
**Right:** `from kash.exec.action_exec import ExecContext`

**Wrong:** `action.execute()` or `action.run()`  
**Right:** `run_action_with_caching(context, action_input)`

## Benefits Achieved

1. **Zero Friction:** Works immediately, installs when needed
2. **Professional Processing:** Full caching, deduplication, indexing
3. **Extensible:** Drop Python file → New action available
4. **Clean Architecture:** Clear TypeScript/Python boundary
5. **Performance:** ~200ms conversion after first run (cached)

## File Structure
```
electron/
├── main/
│   ├── python-bridge.ts       # TypeScript-Python interface
│   ├── kash-installer.ts      # Lazy installation system
│   ├── kash-actions-config.ts # Action configuration
│   └── process-manager.ts     # File routing integration
└── resources/
    ├── kash-ultimate-runner.py # Unified execution engine
    └── kash_docx_action.py     # Custom DOCX action

.aipaste/
├── kash-env/                   # Python environment
├── kash-workspace/             # FileStore workspace
└── enabled-actions.json        # User configuration
```

## Testing

Test DOCX conversion:
```bash
# Create test file
python3 -c "from docx import Document; doc = Document(); doc.add_heading('Test', 0); doc.save('/tmp/test.docx')"

# Test conversion
~/.aipaste/kash-env/cpython-3.11.13-macos-aarch64-none/bin/python3 \
  electron/resources/kash-ultimate-runner.py \
  /tmp/test.docx --action=docx_to_markdown
```

## Future Extensions

Adding new actions:
1. Create Python file with `@kash_action` decorator
2. Add to `custom_actions` list in runner
3. Add configuration in `kash-actions-config.ts`
4. Actions auto-load on next run

## Conclusion

This integration brings enterprise-grade document processing to AiPaste through proper Kash embedding. The architecture is clean, extensible, and follows Kash's intended patterns, ensuring reliability and performance.