# Virtual File System Implementation - Action Plan

## Current Status

### Completed Foundation
- **S3 Object Key System**: File paths converted to unique object keys for database storage
- **File Variant Relationships**: Convex schema supporting parent-child relationships between original files and AI-generated variants (transcripts, summaries, thumbnails)
- **Local Cache Structure**: Binary cache directory established at `~/.neutralbase/binary-cache/`
- **Basic API Endpoints**: S3 service running on localhost:9000 with upload/download URL generation

### Architecture Achieved
```
File Path → Object Key → Convex Database Storage
Local Cache ↔ S3 Service ↔ Metadata Management
```

## Files Provider API Research

Files Provider API - hooks into file system operations, intercepts when user opens files
- Windows: ProjFS
- macOS: VFS integration
- Linux: FUSE

Basic flow: user clicks file → provider checks cache → download if missing → return local path

Could map our object keys to virtual paths:
"abc123-def456" → "/VirtualDrive/video.mp4"

When file opened:
1. Check binary cache first
2. If missing, use object key to download from S3
3. Cache locally, return path

Convex already has metadata + relationships, provider just queries that

Need to build:
- Virtual folder mounting
- File enumeration from S3 objects
- Download on open
- Cache management
- Eventually: file editing, variants display, prefetching

Concerns:
- Admin perms for drivers
- Background service needed
- Big file performance
- Cache cleanup

What we have: object keys, variants in Convex, cache structure, S3 URLs
What's missing: actual provider implementation, OS integration, file writes

Big project but foundation solid.

## Implementation Roadmap

### Phase 1: Cache Foundation (This Week)
Alex's priority: validate basic functionality first

**Day 1-2: Enhanced Cache Testing**
- Create test files of various sizes (1MB, 5MB, 10MB)
- Test `copyToCache()` with real files
- Validate `isBinaryCached()` works correctly
- Test cache directory structure

**Day 3-4: Download Functionality**
- Implement actual file download in `downloadToCache()`
- Test S3 → cache workflow with real files
- Add progress tracking for large files
- Handle download failures gracefully

**Day 5: File Size Rule Testing**
- Test `shouldBackupToCloud()` with various file sizes
- Create workflow: desktop file > 5MB → S3 backup + local cache
- Validate both copies exist and are accessible

### Phase 2: Simple UI for Testing (Next Week)
Basic interface to test all functionality

**Web UI Components:**
- File upload with size detection
- Cache status display
- Download button for S3 objects
- File list showing cache status

**Test Scenarios:**
- Upload small file (< 5MB) → stays local
- Upload large file (> 5MB) → backup to S3 + cache locally
- Access cached file → instant return
- Access non-cached file → download + cache + return

### Phase 3: Files Provider API Prototype (Week 3)
Start simple virtual file system

**macOS Focus First:**
- Research FSEvents and VFS integration
- Create basic virtual mount point
- List S3 objects as virtual files
- Handle basic file open operations

## Technical Foundation

### Convex Integration
- S3 object keys stored instead of file paths
- File variant relationships for AI-generated content
- Query functions for hierarchical file management

### S3 Service
- Local development server on port 9000
- Presigned URL generation for upload/download
- Metadata management with object key mapping
- Cache-first retrieval logic

### File Workflow
```
User File → Object Key Generation → Metadata Storage → Cache Management → S3 Integration
```

## Meeting Outcomes (Oct 18, 2025)

Alex feedback:
- Start with simple cache experiments first
- Build download button for S3 → local cache
- Test 5MB file size rule (auto backup to cloud)
- Validate foundation before complex virtual file system
- Focus on practical experiments over advanced features

Agreed next steps:
- Prove basic cache/download workflow works
- Simple UI for testing file operations
- Research Files Provider API implementation approach
- Plan virtual file system integration after foundation solid

## Immediate Action Items

Week 1: Cache validation + download testing
- Test binary cache with real files
- Build simple download S3 → cache function
- Validate 5MB rule with test files
- Create basic UI for testing

Week 2: Files Provider API prototype
- Research platform-specific implementation (start with macOS)
- Create proof of concept virtual folder
- Test file enumeration from S3 objects
- Basic file open functionality

Week 3: Integration testing
- Connect virtual files to cache system
- Test file access performance
- Handle cache misses properly
- Validate user experience