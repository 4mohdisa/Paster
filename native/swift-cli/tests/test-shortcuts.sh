#!/bin/bash

echo "=== AiPaste CLI Quick Test Suite ==="
echo ""

# Path relative to tests directory
CLI_PATH="../.build/debug/AiPasteHelper"

# Check if binary exists
if [ ! -f "$CLI_PATH" ]; then
    echo "Binary not found. Building..."
    (cd .. && swift build)
fi

# Test basic functionality
echo "1. Testing basic command:"
$CLI_PATH test
echo ""

# Check settings
echo "2. Current settings:"
$CLI_PATH settings get
echo ""

# Test paste with sample data
echo "3. Testing paste with sample data:"
echo -e "Product\tPrice\tQuantity\nApple\t$1.99\t5\nBanana\t$0.99\t12\nOrange\t$2.49\t8" | pbcopy
echo "Copied table data to clipboard"
$CLI_PATH paste --simulate
echo ""

# Test different formats
echo "4. Testing different output formats:"
echo ""

echo "4a. Simple format:"
$CLI_PATH settings set -k outputFormat -v simple > /dev/null
echo -e "A\tB\nC\tD" | pbcopy
$CLI_PATH paste --simulate | jq -r '.data' | head -5
echo ""

echo "4b. Markdown format:"
$CLI_PATH settings set -k outputFormat -v markdown > /dev/null
echo -e "A\tB\nC\tD" | pbcopy
$CLI_PATH paste --simulate | jq -r '.data' | head -5
echo ""

echo "4c. Pretty-printed format:"
$CLI_PATH settings set -k outputFormat -v pretty-printed > /dev/null
echo -e "A\tB\nC\tD" | pbcopy
$CLI_PATH paste --simulate | jq -r '.data' | head -7
echo ""

# Test prefix toggle
echo "5. Testing prefix toggle:"
$CLI_PATH settings set -k usePrefixEnabled -v false > /dev/null
echo -e "X\tY\n1\t2" | pbcopy
echo "With prefix disabled:"
$CLI_PATH paste --simulate | jq -r '.data'
echo ""

$CLI_PATH settings set -k usePrefixEnabled -v true > /dev/null
echo "With prefix enabled:"
$CLI_PATH paste --simulate | jq -r '.data' | head -5
echo ""

# Reset settings
$CLI_PATH settings reset > /dev/null
echo "6. Settings reset to defaults"