# Pre-Task Hook for AiPaste Development

## Automatic Context Loading
Before working on any task in this project, check:

1. **Read Current Progress**
   - File: `agent-docs/MASTER_PROGRESS_REPORT.md`
   - Check: Current phase, completion percentage, blockers

2. **Review Last Work**
   - Check latest `agent-docs/REPORT_*.md` file
   - Understand what was last implemented

3. **Verify Environment**
   ```bash
   # Verify Swift CLI builds
   cd swift-cli && swift build
   
   # Test basic functionality
   ./.build/debug/AiPasteHelper test
   ```

4. **Check Active Phase**
   - Phase 1: Foundation ✅ Complete
   - Phase 2: Core Features 🔄 Current
   - Phase 3: UI/UX ⏳ Pending
   - Phase 4: Production ⏳ Pending

5. **Identify Next Task**
   From MASTER_PROGRESS_REPORT.md → "Next Immediate Steps":
   - Priority 1: OCR Implementation
   - Priority 2: EventTap Integration  
   - Priority 3: Permissions

## Required Understanding
- We're building a Swift CLI to bridge native macOS features to Electron
- Current implementation has table formatting and clipboard monitoring working
- Using JSON IPC protocol for communication
- Following exact logic from original AiPaste and TRex codebases

## Do Not Proceed If:
- Swift CLI doesn't build
- Previous tests are failing
- There are uncommitted breaking changes

## Task Planning Template
```markdown
Task: [What we're building]
Phase: [1-4]
Dependencies: [What must work first]
Estimated Time: [X hours]
Success Criteria: [How we know it's done]
```