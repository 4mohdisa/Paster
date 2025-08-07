# Post-Task Hook for AiPaste Development

## Required Updates After Any Work

### 1. Update Progress Report
File: `agent-docs/MASTER_PROGRESS_REPORT.md`

Update these sections:
- [ ] Overall completion percentage
- [ ] Phase status table
- [ ] "What's Working" section
- [ ] Known issues (if any)
- [ ] Next immediate steps

### 2. Create Implementation Report
Create: `agent-docs/REPORT_[FEATURE]_[DATE].md`

Must include:
- Summary of what was built
- Files created/modified
- Technical details
- Test results
- Performance metrics
- Next steps

### 3. Run Verification Tests
```bash
# Swift CLI tests
./.build/debug/AiPasteHelper test
echo -e "A\tB\nC\tD" | ./.build/debug/AiPasteHelper format --stdin

# TypeScript build
npm run build

# Check for errors
swift build 2>&1 | grep -i error
```

### 4. Update Todo List
Update the TodoWrite with:
- Completed items → "completed"
- Current work → "in_progress"
- Next items → "pending"

### 5. Document Session Results

In MASTER_PROGRESS_REPORT.md under "Session Notes":
```markdown
### Session [X] Notes
- Completed: [What was finished]
- Issues: [Any problems encountered]
- Blockers: [Anything preventing progress]
- Time spent: [X hours]
```

### 6. Link Reports
In the Implementation Reports table, add:
```markdown
| [Component] | ✅ | [Report](./REPORT_NAME.md) | [Date] |
```

## Quality Checklist
- [ ] Code follows original Swift patterns
- [ ] Tests are passing
- [ ] Documentation updated
- [ ] Progress tracked
- [ ] Next steps defined

## If Work Is Incomplete
Create handoff notes:
```markdown
## Incomplete Work
- File: [path] needs [what]
- Function: [name] is partially implemented
- Next: [Specific instruction to continue]
```

## Commit Message Format
```
feat(component): Brief description

- Detail 1
- Detail 2

Progress: Phase X - Y% complete
Docs: agent-docs/REPORT_NAME.md
```