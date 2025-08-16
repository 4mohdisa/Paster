#!/usr/bin/env bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# CLI binary path - relative to tests directory
CLI_PATH="../.build/debug/AiPasteHelper"

# Test result tracking
declare -a FAILED_TESTS=()

# Helper functions
log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test assertion function
assert_contains() {
    local haystack="$1"
    local needle="$2"
    local test_name="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if echo "$haystack" | grep -q "$needle"; then
        log_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "$test_name - Expected to contain: '$needle'"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return 1
    fi
}

assert_json_field() {
    local json="$1"
    local field="$2"
    local expected="$3"
    local test_name="$4"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    local actual=$(echo "$json" | jq -r "$field" 2>/dev/null || echo "PARSE_ERROR")
    
    if [ "$actual" = "$expected" ]; then
        log_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "$test_name - Expected: '$expected', Got: '$actual'"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return 1
    fi
}

assert_command_success() {
    local cmd="$1"
    local test_name="$2"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if eval "$cmd" > /dev/null 2>&1; then
        log_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "$test_name - Command failed: $cmd"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        FAILED_TESTS+=("$test_name")
        return 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [ ! -f "$CLI_PATH" ]; then
        log_error "CLI binary not found at $CLI_PATH"
        log_info "Building Swift CLI..."
        (cd native/swift-cli && swift build)
    fi
    
    # Check required commands
    for cmd in jq pbcopy pbpaste; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd is required but not installed"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

# Test Suite 1: Basic CLI functionality
test_basic_cli() {
    echo ""
    log_info "=== TEST SUITE: Basic CLI Functionality ==="
    
    # Test 1: CLI runs and shows help
    local help_output=$($CLI_PATH --help 2>&1 || true)
    assert_contains "$help_output" "AI-powered clipboard" "CLI shows help text"
    
    # Test 2: Test command works
    local test_result=$($CLI_PATH test)
    assert_json_field "$test_result" ".success" "true" "Test command returns success"
    assert_json_field "$test_result" ".message" "AiPasteHelper is working!" "Test command message"
}

# Test Suite 2: Settings Management
test_settings() {
    echo ""
    log_info "=== TEST SUITE: Settings Management ==="
    
    # Reset settings first
    $CLI_PATH settings reset > /dev/null
    
    # Test 1: Get default settings
    local settings=$($CLI_PATH settings get)
    assert_json_field "$settings" ".success" "true" "Settings get command succeeds"
    
    # Test 2: Set a value
    local set_result=$($CLI_PATH settings set -k outputFormat -v markdown)
    assert_json_field "$set_result" ".success" "true" "Settings set command succeeds"
    
    # Test 3: Verify the value was set
    local get_result=$($CLI_PATH settings get)
    local format=$(echo "$get_result" | jq -r '.data' | jq -r '.outputFormat')
    assert_json_field "{\"format\":\"$format\"}" ".format" "markdown" "Setting was persisted"
    
    # Test 4: Reset settings
    local reset_result=$($CLI_PATH settings reset)
    assert_json_field "$reset_result" ".success" "true" "Settings reset succeeds"
    
    # Test 5: Verify reset worked
    local after_reset=$($CLI_PATH settings get)
    local format_after=$(echo "$after_reset" | jq -r '.data' | jq -r '.outputFormat')
    assert_json_field "{\"format\":\"$format_after\"}" ".format" "simple" "Settings reset to defaults"
}

# Test Suite 3: Shortcuts Daemon Check
test_shortcuts() {
    echo ""
    log_info "=== TEST SUITE: Shortcuts Daemon ==="
    
    # Test 1: Check if shortcuts command exists
    local shortcuts_help=$($CLI_PATH shortcuts --help 2>&1 || true)
    assert_contains "$shortcuts_help" "Monitor global keyboard shortcuts" "Shortcuts command exists"
    
    # Test 2: Test shortcuts with dry-run (won't actually start daemon)
    # Note: We can't fully test shortcuts without accessibility permission
    log_info "Shortcuts daemon requires accessibility permission - skipping runtime test"
}

# Test Suite 4: Table Formatting
test_formatting() {
    echo ""
    log_info "=== TEST SUITE: Table Formatting ==="
    
    # Test data
    local test_data="Name\tAge\tCity
John\t30\tNY
Jane\t25\tLA"
    
    # Test 1: Simple format
    echo -e "$test_data" | pbcopy
    local simple=$($CLI_PATH paste --simulate)
    assert_json_field "$simple" ".success" "true" "Simple format succeeds"
    assert_contains "$(echo "$simple" | jq -r '.data')" "|" "Simple format contains pipes"
    
    # Test 2: Markdown format
    $CLI_PATH settings set -k outputFormat -v markdown > /dev/null
    echo -e "$test_data" | pbcopy
    local markdown=$($CLI_PATH paste --simulate)
    assert_contains "$(echo "$markdown" | jq -r '.data')" "| Name | Age | City |" "Markdown format has proper table"
    
    # Test 3: Pretty format
    $CLI_PATH settings set -k outputFormat -v pretty-printed > /dev/null
    echo -e "$test_data" | pbcopy
    local pretty=$($CLI_PATH paste --simulate)
    assert_contains "$(echo "$pretty" | jq -r '.data')" "+" "Pretty format has borders"
    
    # Test 4: HTML format
    $CLI_PATH settings set -k outputFormat -v html > /dev/null
    echo -e "$test_data" | pbcopy
    local html=$($CLI_PATH paste --simulate)
    assert_contains "$(echo "$html" | jq -r '.data')" "<table>" "HTML format has table tag"
    
    # Reset format
    $CLI_PATH settings reset > /dev/null
}

# Test Suite 5: Prefix Feature
test_prefix() {
    echo ""
    log_info "=== TEST SUITE: Prefix Feature ==="
    
    local test_data="A\tB\n1\t2"
    
    # Test 1: Default prefix enabled
    echo -e "$test_data" | pbcopy
    local with_prefix=$($CLI_PATH paste --simulate)
    assert_contains "$(echo "$with_prefix" | jq -r '.data')" "Below is a table" "Default prefix present"
    
    # Test 2: Disable prefix
    $CLI_PATH settings set -k usePrefixEnabled -v false > /dev/null
    echo -e "$test_data" | pbcopy
    local no_prefix=$($CLI_PATH paste --simulate)
    local content=$(echo "$no_prefix" | jq -r '.data')
    if echo "$content" | grep -q "Below is a table"; then
        log_error "Prefix still present when disabled"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        log_success "Prefix correctly disabled"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
    
    # Test 3: Custom prefix
    $CLI_PATH settings set -k usePrefixEnabled -v true > /dev/null
    $CLI_PATH settings set -k userDefinedPrefix -v "Custom: Data follows" > /dev/null
    echo -e "$test_data" | pbcopy
    local custom=$($CLI_PATH paste --simulate)
    assert_contains "$(echo "$custom" | jq -r '.data')" "Custom: Data follows" "Custom prefix applied"
    
    # Reset
    $CLI_PATH settings reset > /dev/null
}

# Test Suite 6: Edge Cases
test_edge_cases() {
    echo ""
    log_info "=== TEST SUITE: Edge Cases ==="
    
    # Test 1: Empty clipboard
    echo -n "" | pbcopy
    local empty=$($CLI_PATH paste --simulate 2>&1 || true)
    assert_json_field "$empty" ".success" "false" "Empty clipboard handled"
    
    # Test 2: Non-table data
    echo "Just plain text without tabs" | pbcopy
    local plain=$($CLI_PATH paste --simulate)
    assert_json_field "$plain" ".success" "false" "Non-table data rejected"
    
    # Test 3: Large table (100 rows)
    local large_data=""
    for i in {1..100}; do
        large_data+="Row$i\tData$i\tValue$i\n"
    done
    echo -e "$large_data" | pbcopy
    local large=$($CLI_PATH paste --simulate)
    assert_json_field "$large" ".success" "true" "Large table handled"
    
    # Test 4: Special characters
    echo -e "Name\tValue\nTest\"Quote\t\$100\nNew\nLine\tData" | pbcopy
    local special=$($CLI_PATH paste --simulate)
    assert_json_field "$special" ".success" "true" "Special characters handled"
}

# Test Suite 7: Integration Test
test_integration() {
    echo ""
    log_info "=== TEST SUITE: Integration Test ==="
    
    # Full workflow test
    $CLI_PATH settings reset > /dev/null
    $CLI_PATH settings set -k outputFormat -v markdown > /dev/null
    $CLI_PATH settings set -k usePrefixEnabled -v true > /dev/null
    
    echo -e "Product\tPrice\tStock\nApple\t\$1.99\t100" | pbcopy
    local result=$($CLI_PATH paste --simulate)
    
    assert_json_field "$result" ".success" "true" "Integration: paste succeeds"
    assert_contains "$(echo "$result" | jq -r '.data')" "Below is a table" "Integration: has prefix"
    assert_contains "$(echo "$result" | jq -r '.data')" "| ----" "Integration: markdown format"
    assert_contains "$(echo "$result" | jq -r '.data')" "Apple" "Integration: data preserved"
}

# Main test runner
main() {
    echo ""
    echo "============================================"
    echo "     AiPaste CLI Test Suite"
    echo "============================================"
    
    # Check prerequisites
    check_prerequisites
    
    # Run all test suites
    test_basic_cli
    test_settings
    test_permissions
    test_formatting
    test_prefix
    test_edge_cases
    test_integration
    
    # Print summary
    echo ""
    echo "============================================"
    echo "              Test Summary"
    echo "============================================"
    echo -e "Tests Run:    ${TESTS_RUN}"
    echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
    echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
    
    if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
        echo ""
        echo "Failed Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
    fi
    
    echo ""
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
        exit 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED${NC}"
        exit 1
    fi
}

# Run tests
main "$@"