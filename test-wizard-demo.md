# CLI Prompt Wizard - Demo & Testing Guide

## Overview
The new hacker-chic CLI prompt wizard provides a modern, professional terminal experience for configuring the Immich Album Downloader when run interactively.

## Visual Design Features

### Header Banner
```
╔════════════════════════════════════════════════════════════════╗
║   Immich Album Downloader - Configuration                    ║
║   v1.x • Interactive Setup                                    ║
╚════════════════════════════════════════════════════════════════╝

? Ctrl+C to cancel • Tab for next • Enter to confirm • ↑↓ for history
```

### Section Organization
Prompts are organized into three logical sections:

1. **Server Configuration [REQUIRED]**
   - Immich server base URL
   - Immich API key

2. **Download Settings [OPTIONAL]**
   - Download output directory
   - Concurrent downloads
   - Maximum retry attempts

3. **Persistence [OPTIONAL]**
   - Save configuration to .env?

### Status Indicators
- `✓` (green) - Validation passed
- `✗` (red) - Validation failed / Required field
- `?` (cyan) - Question/prompt
- `ℹ` (cyan) - Information
- `!` (yellow) - Warning

### Color Coding
- **Cyan** - Primary info and questions
- **Green** - Success and valid inputs
- **Yellow** - Warnings
- **Red** - Errors and required fields
- **Gray** - Muted text and hints

## Testing Instructions

### Test 1: Interactive Mode (Missing Config)
```bash
# Run without any config - should trigger wizard
npm run download
```

### Test 2: With CLI Flags (Skip Wizard)
```bash
# Provides all required config - skips wizard
npm run download \
  --base-url https://immich.example.com \
  --api-key your-api-key-here \
  --all \
  --dry-run
```

### Test 3: Partial Config (Wizard for Missing)
```bash
# Provides one required field - wizard prompts for the other
npm run download --base-url https://immich.example.com
```

### Test 4: Validation Feedback
When testing validation, try these inputs to see feedback:

**Invalid URL Examples:**
- `immich.example.com` (missing protocol)
- `ftp://immich.example.com` (wrong protocol)
- Empty input (required field)

**Short API Key:**
- Any string less than 10 characters

**Out of Range Concurrency:**
- Enter 0, -1, or 100+ when prompted
- Valid range: 1-50

**Out of Range Max Retries:**
- Enter -1 or 11+ when prompted
- Valid range: 0-10

## Features Implemented

### ✓ Professional Design System
- Color utilities with semantic naming (primary, success, warning, error, muted)
- Unicode indicators for validation states
- ASCII box-drawing characters for borders

### ✓ Field Metadata Structure
- Organized field definitions with:
  - Label and section assignment
  - Help text and hints
  - CLI flag equivalents
  - Validation rules

### ✓ Enhanced Validators
- Professional error messages explaining rules
- Context-aware feedback (e.g., shows actual vs. expected values)
- Real-time feedback during input

### ✓ Section Grouping
- Logical organization with visual separators
- [REQUIRED] and [OPTIONAL] indicators
- Clean ASCII borders between sections

### ✓ Command Equivalents Display
- Shows how to use CLI flags instead of wizard
- Helps users understand command-line alternatives

### ✓ Status Indicators
- Visual feedback with Unicode symbols
- Color-coded validation states
- Non-color fallbacks using symbols

## Expected Output Example

```
╔════════════════════════════════════════════════════════════════╗
║   Immich Album Downloader - Configuration                    ║
║   v1.x • Interactive Setup                                    ║
╚════════════════════════════════════════════════════════════════╝

? Ctrl+C to cancel • Tab for next • Enter to confirm • ↑↓ for history

Server Configuration [REQUIRED]
────────────────────────────────────────────────────────────────
? [REQUIRED] Immich server base URL
  › https://immich.example.com
  ✓ Valid HTTPS URL
  → Skip this: immich-album-downloader --base-url https://immich.example.com

────────────────────────────────────────────────────────────────
? [REQUIRED] Immich API key
  › •••••••••••••••••
  ✓ API key valid (20 characters)
  → Skip this: immich-album-downloader --api-key your-secret-key

────────────────────────────────────────────────────────────────

Download Settings [OPTIONAL]
────────────────────────────────────────────────────────────────
? [OPTIONAL] Download output directory
  › ./downloads

? [OPTIONAL] Concurrent downloads
  › 5

? [OPTIONAL] Maximum retry attempts
  › 3

────────────────────────────────────────────────────────────────

Persistence [OPTIONAL]
────────────────────────────────────────────────────────────────
? [OPTIONAL] Save configuration to .env?
  » Yes  No

✓ Configuration complete!
```

## Code Structure

### Design System (`colors` object)
- Provides semantic color functions
- Maintains visual consistency
- Easy to update theme globally

### Indicators (`indicators` object)
- Unicode symbols for validation states
- Consistent throughout UI
- Accessible (not color-only)

### Field Metadata (`CONFIG_FIELDS`)
- Single source of truth for field definitions
- Includes hints, help text, CLI flags
- Easy to maintain and extend

### Validators
- Separate validation functions
- Professional error messages
- Reusable validation logic

### Prompt Builder
- Groups fields by section
- Adds visual separators
- Handles different input types

## Backward Compatibility

- Export interface unchanged: `export async function promptForConfig(current)`
- Existing integration in `src/lib/config.ts` works without modification
- Can still skip wizard with `--interactive false` or by providing config via env/flags
- All validation logic preserved from original implementation

## NPM Publishing Ready

- Uses popular, well-maintained libraries (chalk, inquirer)
- Clean, maintainable code structure
- Professional UX suitable for public CLI tool
- Tested with different input scenarios
