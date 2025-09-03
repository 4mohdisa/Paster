# Work Hooks Protocol - AiPaste Development

## Purpose
This document defines the mandatory pre-work and post-work procedures for maintaining project continuity and documentation quality.

---

## 🔵 PRE-WORK HOOKS (Before Starting Any Task)

### 1. Context Loading (2 minutes)
```bash
# Read these files in order:
1. MASTER_PROGRESS_REPORT.md     # Current state
2. Last implementation report     # Recent changes
3. COMPLETE_PROJECT_ROADMAP.md   # Overall vision
```

### 2. Environment Verification (1 minute)
```bash
# Terminal 1: Verify Swift CLI
cd swift-cli
swift build
./.build/release/AiPasteHelper test

# Terminal 2: Verify Electron
npm run build
```

### 3. Task Identification
- [ ] Check MASTER_PROGRESS_REPORT.md → "Next Immediate Steps"
- [ ] Identify which phase this work belongs to
- [ ] Check for dependencies and blockers
- [ ] Estimate completion time

### 4. Create Work Plan
```markdown
## Work Session: [DATE]
### Objective: [What we're building]
### Phase: [1-4]
### Dependencies: [What must work first]
### Success Criteria: [How we know it's done]
```

---

## 🔴 POST-WORK HOOKS (After Completing Any Task)

### 1. Update Progress Report (5 minutes)
```markdown
# In MASTER_PROGRESS_REPORT.md, update:
1. Overall completion percentage
2. Phase status table
3. "What's Working" section
4. Known issues if any
5. Next immediate steps
```

### 2. Create Implementation Report
```bash
# Create new file: agent-docs/REPORT_[FEATURE]_[DATE].md
```

Template:
```markdown
# Implementation Report: [Feature Name]

## Summary
- **Date**: [Current Date]
- **Duration**: [Time spent]
- **Status**: ✅ Complete / ⚠️ Partial / ❌ Blocked

## What Was Built
### Files Created
- [List new files]

### Files Modified
- [List modified files with line ranges]

### Key Components
[Describe main components added]

## Technical Details
### Architecture Decision
[Why this approach]

### Code Highlights
```language
[Key code snippets]
```

### Integration Points
[How it connects to existing code]

## Testing Performed
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

### Test Results
[Document test outcomes]

## Issues & Resolutions
| Issue | Resolution | Status |
|-------|------------|--------|
| [Issue] | [How fixed] | ✅/❌ |

## Performance Impact
- Memory: [Before/After]
- CPU: [Impact]
- Speed: [Metrics]

## Next Steps
1. [What comes next]
2. [Dependencies for next phase]

## Code Quality Checklist
- [ ] Follows original Swift patterns
- [ ] Error handling implemented
- [ ] Comments added where needed
- [ ] No hardcoded values
- [ ] Security considered
```

### 3. Update Todo List
```typescript
// Update todos with actual progress
TodoWrite({
  completed: ["items finished"],
  inProgress: ["current work"],
  pending: ["next items"]
})
```

### 4. Run Verification Suite
```bash
# Swift CLI Tests
./.build/release/AiPasteHelper test
echo -e "A\tB\nC\tD" | ./.build/release/AiPasteHelper format --stdin

# TypeScript Build
npm run build

# Check for issues
swift build 2>&1 | grep -i error
npm run typecheck 2>&1 | grep -i error
```

### 5. Commit with Structured Message
```bash
git add .
git commit -m "feat(swift-cli): [what was added]

- [Detail 1]
- [Detail 2]
- [Detail 3]

Progress: Phase [X] - [Y]% complete
Report: agent-docs/REPORT_[NAME]_[DATE].md"
```

---

## 📊 Progress Tracking Rules

### Completion Percentages
- Each phase has equal weight (25%)
- Within phase: divide by number of components
- Update after each component completion

### Status Symbols
- ✅ Complete: Tested and working
- 🔄 In Progress: Currently being worked on
- ⏳ Pending: Not started
- ❌ Blocked: Has unresolved dependencies
- ⚠️ Partial: Works but needs improvement

### Report Tagging
Every implementation report must be linked in MASTER_PROGRESS_REPORT.md:
```markdown
| Component | Status | Report | Date |
|-----------|--------|--------|------|
| [Feature] | ✅ | [Report](./REPORT_NAME.md) | [Date] |
```

---

## 🔄 Session Continuity Protocol

### Starting New Session
1. Read MASTER_PROGRESS_REPORT.md first
2. Check "Next Immediate Steps"
3. Verify environment still works
4. Continue from last stopping point

### Ending Session
1. Update all progress markers
2. Document any partial work
3. List exact next steps
4. Note any blockers

### Handoff Notes
If work is incomplete, create:
```markdown
## Handoff Notes
### What's Done
- [Completed items]

### What's Partial
- [File]: Lines X-Y need completion
- [Feature]: Missing [component]

### Exact Next Step
"Open [file] and implement [function] starting at line [X]"

### Commands to Resume
```bash
cd swift-cli
# Continue with...
```
```

---

## 🚨 Emergency Recovery

If something breaks:

### 1. Check Last Known Good State
```bash
git log --oneline -5
git diff HEAD~1
```

### 2. Verify Build Issues
```bash
# Swift
swift build -v

# TypeScript
npm run build -- --verbose
```

### 3. Document in Progress Report
Add to "Known Issues":
- What broke
- When it broke
- Attempted fixes
- Current status

---

## 📝 Report Quality Standards

### Every Report Must Have:
1. **Clear summary** - One paragraph explaining what was done
2. **File listing** - Every file touched
3. **Test evidence** - Actual command outputs
4. **Next steps** - Specific, actionable items
5. **Time tracking** - How long things took

### Code Snippets Must:
- Show actual working code
- Include context (file path, line numbers)
- Highlight key changes
- Explain non-obvious logic

---

## 🎯 Success Metrics

Track these for each session:
- Features completed vs planned
- Tests passing vs failing
- Time estimated vs actual
- Blockers encountered vs resolved

---

*Protocol Version: 1.0*
*Effective Date: Current Session*
*Review Frequency: After each phase completion*