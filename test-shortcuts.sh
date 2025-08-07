#!/bin/bash

echo "=== AiPaste CLI Test Suite ==="
echo ""

# Check permissions
echo "1. Checking permissions..."
./.build/debug/AiPasteHelper permissions all
echo ""

# Check settings
echo "2. Current settings:"
./.build/debug/AiPasteHelper settings get
echo ""

# Test paste with sample data
echo "3. Testing paste with sample data:"
echo -e "Product\tPrice\tQuantity\nApple\t$1.99\t5\nBanana\t$0.99\t12\nOrange\t$2.49\t8" | pbcopy
echo "Copied table data to clipboard"
./.build/debug/AiPasteHelper paste --simulate
echo ""

# Test different formats
echo "4. Testing different output formats:"
echo ""

echo "4a. Simple format:"
./.build/debug/AiPasteHelper settings set -k outputFormat -v simple > /dev/null
echo -e "A\tB\nC\tD" | pbcopy
./.build/debug/AiPasteHelper paste --simulate | jq -r '.data' | head -5
echo ""

echo "4b. Markdown format:"
./.build/debug/AiPasteHelper settings set -k outputFormat -v markdown > /dev/null
echo -e "A\tB\nC\tD" | pbcopy
./.build/debug/AiPasteHelper paste --simulate | jq -r '.data' | head -5
echo ""

echo "4c. Pretty-printed format:"
./.build/debug/AiPasteHelper settings set -k outputFormat -v pretty-printed > /dev/null
echo -e "A\tB\nC\tD" | pbcopy
./.build/debug/AiPasteHelper paste --simulate | jq -r '.data' | head -7
echo ""

# Test prefix toggle
echo "5. Testing prefix toggle:"
./.build/debug/AiPasteHelper settings set -k usePrefixEnabled -v false > /dev/null
echo -e "X\tY\n1\t2" | pbcopy
echo "With prefix disabled:"
./.build/debug/AiPasteHelper paste --simulate | jq -r '.data'

./.build/debug/AiPasteHelper settings set -k usePrefixEnabled -v true > /dev/null
echo ""

# Reset to defaults
echo "6. Resetting to defaults:"
./.build/debug/AiPasteHelper settings reset
echo ""

echo "=== Test Complete ==="
echo ""
echo "To test shortcuts (requires accessibility permission):"
echo "1. Grant accessibility permission in System Preferences"
echo "2. Run: ./.build/debug/AiPasteHelper shortcuts"
echo "3. Copy table data"
echo "4. Press Cmd+Shift+V in any text field"
echo ""
echo "To test with debug mode:"
echo "./.build/debug/AiPasteHelper shortcuts --debug"