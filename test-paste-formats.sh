#!/bin/bash

echo "=== Testing Paste Command with All Formats ==="
echo ""

# Test data
TEST_DATA="Name\tAge\tCity\nJohn\t30\tNew York\nJane\t25\tLos Angeles\nBob\t35\tChicago"

# Function to test a format
test_format() {
    local format=$1
    echo "Testing $format format:"
    echo "------------------------"
    
    # Set the format
    ./swift-cli/.build/debug/AiPasteHelper settings set -k outputFormat -v "$format" > /dev/null
    
    # Copy test data and run paste
    echo -e "$TEST_DATA" | pbcopy
    RESULT=$(./swift-cli/.build/debug/AiPasteHelper paste --simulate)
    
    # Extract and display the formatted data
    echo "$RESULT" | jq -r '.data' | head -15
    echo ""
}

# Test each format
echo "1. Simple format (default pipes):"
test_format "simple"

echo "2. Markdown format (with header separator):"
test_format "markdown"

echo "3. Pretty-printed format (with borders):"
test_format "pretty-printed"

echo "4. HTML format (table tags):"
test_format "html"

# Test prefix toggle
echo "5. Testing prefix toggle:"
echo "------------------------"

# Enable prefix
./swift-cli/.build/debug/AiPasteHelper settings set -k usePrefixEnabled -v true > /dev/null
echo "With prefix enabled:"
echo -e "A\tB\n1\t2" | pbcopy
./swift-cli/.build/debug/AiPasteHelper paste --simulate | jq -r '.data' | head -5
echo ""

# Disable prefix
./swift-cli/.build/debug/AiPasteHelper settings set -k usePrefixEnabled -v false > /dev/null
echo "With prefix disabled:"
echo -e "A\tB\n1\t2" | pbcopy
./swift-cli/.build/debug/AiPasteHelper paste --simulate | jq -r '.data' | head -5
echo ""

# Custom prefix
./swift-cli/.build/debug/AiPasteHelper settings set -k usePrefixEnabled -v true > /dev/null
./swift-cli/.build/debug/AiPasteHelper settings set -k userDefinedPrefix -v "Custom prefix: Here's the data" > /dev/null
echo "With custom prefix:"
echo -e "X\tY\n3\t4" | pbcopy
./swift-cli/.build/debug/AiPasteHelper paste --simulate | jq -r '.data' | head -5
echo ""

# Reset to defaults
echo "6. Resetting to defaults..."
./swift-cli/.build/debug/AiPasteHelper settings reset
echo ""

echo "=== Format Testing Complete ==="