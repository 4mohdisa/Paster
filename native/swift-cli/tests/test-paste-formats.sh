#!/bin/bash

echo "=== Testing Paste Command with All Formats ==="
echo ""

# Path relative to tests directory
CLI_PATH="../.build/release/PasterHelper"

# Test data
TEST_DATA="Name\tAge\tCity\nJohn\t30\tNew York\nJane\t25\tLos Angeles\nBob\t35\tChicago"

# Function to test a format
test_format() {
    local format=$1
    echo "Testing $format format:"
    echo "------------------------"
    
    # Set the format
    $CLI_PATH settings set -k outputFormat -v "$format" > /dev/null
    
    # Copy test data and run paste
    echo -e "$TEST_DATA" | pbcopy
    RESULT=$($CLI_PATH paste --simulate)
    
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
$CLI_PATH settings set -k usePrefixEnabled -v true > /dev/null
echo "With prefix enabled:"
echo -e "A\tB\n1\t2" | pbcopy
$CLI_PATH paste --simulate | jq -r '.data' | head -5
echo ""

# Disable prefix
$CLI_PATH settings set -k usePrefixEnabled -v false > /dev/null
echo "With prefix disabled:"
echo -e "A\tB\n1\t2" | pbcopy
$CLI_PATH paste --simulate | jq -r '.data' | head -5
echo ""

# Reset to defaults
$CLI_PATH settings reset > /dev/null
echo "Settings reset to defaults"