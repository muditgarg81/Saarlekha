"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const efficiency_1 = require("../utils/efficiency");
function runTests() {
    console.log('Starting Efficiency Calculation Verification Tests...');
    let failed = false;
    // Test 1: Standard calculation
    {
        const res = (0, efficiency_1.calculateEfficiency)(80, 100);
        if (res === '80.0') {
            console.log('✓ SUCCESS: Standard calculation (80/100) returned "80.0"');
        }
        else {
            console.error(`✗ FAILURE: Expected "80.0", got "${res}"`);
            failed = true;
        }
    }
    // Test 2: Over-performance (>100%) uncapped
    {
        const res = (0, efficiency_1.calculateEfficiency)(125, 100);
        if (res === '125.0') {
            console.log('✓ SUCCESS: Uncapped over-performance (125/100) returned "125.0"');
        }
        else {
            console.error(`✗ FAILURE: Expected "125.0", got "${res}"`);
            failed = true;
        }
    }
    // Test 3: Zero target returns N/A
    {
        const res = (0, efficiency_1.calculateEfficiency)(50, 0);
        if (res === 'N/A') {
            console.log('✓ SUCCESS: Zero target returned "N/A"');
        }
        else {
            console.error(`✗ FAILURE: Expected "N/A", got "${res}"`);
            failed = true;
        }
    }
    // Test 4: Negative target returns N/A
    {
        const res = (0, efficiency_1.calculateEfficiency)(50, -10);
        if (res === 'N/A') {
            console.log('✓ SUCCESS: Negative target returned "N/A"');
        }
        else {
            console.error(`✗ FAILURE: Expected "N/A", got "${res}"`);
            failed = true;
        }
    }
    // Test 5: Float results formatting
    {
        const res = (0, efficiency_1.calculateEfficiency)(1, 3);
        if (res === '33.3') {
            console.log('✓ SUCCESS: Float results formatting (1/3) returned "33.3"');
        }
        else {
            console.error(`✗ FAILURE: Expected "33.3", got "${res}"`);
            failed = true;
        }
    }
    console.log('\n=========================================');
    if (failed) {
        console.error('✗ EFFICIENCY CALCULATION TESTS FAILED!');
        console.log('=========================================');
        process.exit(1);
    }
    else {
        console.log('ALL EFFICIENCY CALCULATION TESTS PASSED SUCCESSFULLY! 🎉');
        console.log('=========================================');
        process.exit(0);
    }
}
runTests();
