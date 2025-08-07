#!/bin/bash

echo "=== Testing Complete Shortcuts → Paste Flow ==="
echo ""

# 1. Verify accessibility permission
echo "1. Checking accessibility permission..."
PERM_RESULT=$(./.build/debug/AiPasteHelper permissions accessibility)
echo "$PERM_RESULT" | jq -r '.data' | jq '.'
echo ""

# 2. Check current settings
echo "2. Current settings for shortcuts:"
./.build/debug/AiPasteHelper settings get | jq -r '.data' | jq '. | {shortcutModifiers, shortcutKeyCode, outputFormat}'
echo ""

# 3. Start shortcuts daemon in background
echo "3. Starting shortcuts daemon in background..."
./.build/debug/AiPasteHelper shortcuts --debug > shortcuts.log 2>&1 &
SHORTCUTS_PID=$!
echo "Shortcuts daemon PID: $SHORTCUTS_PID"
sleep 2

# 4. Check if daemon is running
if ps -p $SHORTCUTS_PID > /dev/null; then
    echo "✅ Shortcuts daemon is running"
else
    echo "❌ Shortcuts daemon failed to start"
    echo "Check shortcuts.log for errors:"
    cat shortcuts.log
    exit 1
fi
echo ""

# 5. Copy test data to clipboard
echo "4. Copying test table data to clipboard..."
echo -e "Product\tPrice\tStock\nApple\t$1.99\t100\nBanana\t$0.99\t150\nOrange\t$2.49\t75" | pbcopy
echo "Table data copied. Contents:"
pbpaste | head -3
echo ""

# 6. Instructions for manual test
echo "5. Manual test instructions:"
echo "   a) Open any text editor (TextEdit, VS Code, etc.)"
echo "   b) Click in a text field"
echo "   c) Press Cmd+Shift+V"
echo "   d) The formatted table should be pasted"
echo ""
echo "Expected output format (based on settings):"
./.build/debug/AiPasteHelper paste --simulate | jq -r '.data' | head -10
echo ""

# 7. Monitor log for events
echo "6. Monitoring shortcuts.log for events (press Ctrl+C to stop)..."
echo "   Watching for 'shortcut-triggered' events..."
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Cleaning up..."
    if [ ! -z "$SHORTCUTS_PID" ]; then
        kill $SHORTCUTS_PID 2>/dev/null
        echo "Stopped shortcuts daemon"
    fi
    echo "Test complete!"
}

# Set trap for cleanup
trap cleanup EXIT

# Tail the log file
tail -f shortcuts.log | while read line; do
    # Check for JSON output
    if echo "$line" | jq '.' 2>/dev/null | grep -q "shortcut-triggered"; then
        echo "✅ SHORTCUT TRIGGERED!"
        echo "$line" | jq '.'
    elif echo "$line" | jq '.' 2>/dev/null | grep -q "key-debug"; then
        # Show key events in compact form
        echo "$line" | jq -c '{keyCode, cmd, shift, modifiers}'
    fi
done