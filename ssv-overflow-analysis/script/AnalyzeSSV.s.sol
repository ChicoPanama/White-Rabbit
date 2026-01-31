// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/SSVAnalysis.sol";

contract AnalyzeSSVScript is Script {
    SSVAnalysis analyzer;
    ISSVNetwork constant SSV = ISSVNetwork(0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1);
    
    function run() external {
        // Deploy analyzer
        vm.startBroadcast();
        analyzer = new SSVAnalysis();
        vm.stopBroadcast();
        
        console.log("=== SSV Network Integer Overflow Analysis ===");
        console.log("Contract Address: 0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1");
        console.log("Block Number:", block.number);
        console.log("");
        
        // Sample some operator IDs to analyze
        uint256[] memory testOperators = new uint256[](20);
        testOperators[0] = 1;
        testOperators[1] = 10;
        testOperators[2] = 100;
        testOperators[3] = 500;
        testOperators[4] = 1000;
        testOperators[5] = 1500;
        testOperators[6] = 2000;
        testOperators[7] = 2500;
        testOperators[8] = 3000;
        testOperators[9] = 3500;
        testOperators[10] = 4000;
        testOperators[11] = 4500;
        testOperators[12] = 5000;
        testOperators[13] = 5500;
        testOperators[14] = 6000;
        testOperators[15] = 6500;
        testOperators[16] = 7000;
        testOperators[17] = 7500;
        testOperators[18] = 8000;
        testOperators[19] = 8500;
        
        uint256 highRiskOperators = 0;
        uint256 totalValueAtRisk = 0;
        uint256 highestFee = 0;
        uint256 highestFeeOperator = 0;
        
        console.log("Analyzing operator fees and overflow risks...");
        console.log("");
        
        for (uint256 i = 0; i < testOperators.length; i++) {
            uint256 operatorId = testOperators[i];
            
            (
                address owner,
                uint256 fee,
                bool active,
                bool nearOverflow,
                uint256 riskLevel
            ) = analyzer.getOperatorDetails(operatorId);
            
            if (owner != address(0) && active) {
                console.log("Operator ID:", operatorId);
                console.log("  Owner:", owner);
                console.log("  Fee (wei):", fee);
                console.log("  Fee (ETH):", fee / 1e18);
                console.log("  Active:", active);
                console.log("  Near Overflow:", nearOverflow);
                console.log("  Risk Level:", riskLevel);
                
                // Test overflow scenarios
                (bool safeMul, bool safeDiv, bool safeAdd) = analyzer.testOverflowScenarios(operatorId);
                console.log("  Safe Multiplication:", safeMul);
                console.log("  Safe Division:", safeDiv);
                console.log("  Safe Addition:", safeAdd);
                console.log("");
                
                if (nearOverflow) {
                    highRiskOperators++;
                    totalValueAtRisk += fee;
                }
                
                if (fee > highestFee) {
                    highestFee = fee;
                    highestFeeOperator = operatorId;
                }
            }
        }
        
        console.log("=== ANALYSIS SUMMARY ===");
        console.log("High Risk Operators Found:", highRiskOperators);
        console.log("Total Value at Risk (wei):", totalValueAtRisk);
        console.log("Total Value at Risk (ETH):", totalValueAtRisk / 1e18);
        console.log("Highest Fee Found:", highestFee);
        console.log("Highest Fee Operator:", highestFeeOperator);
        console.log("");
        
        if (highRiskOperators > 0) {
            console.log("WARNING: Found operators with potential overflow risks!");
            testExploitScenarios();
        } else {
            console.log("No immediate overflow risks detected in sampled operators");
        }
    }
    
    function testExploitScenarios() internal {
        console.log("=== TESTING EXPLOIT SCENARIOS ===");
        
        // Test various mathematical operations that could trigger overflows
        console.log("Testing mathematical operations for potential exploits...");
        
        uint256 maxUint = type(uint256).max;
        console.log("Max uint256:", maxUint);
        
        // Test edge case values
        uint256[] memory edgeCases = new uint256[](5);
        edgeCases[0] = maxUint - 1;
        edgeCases[1] = maxUint / 2;
        edgeCases[2] = maxUint / 1000;
        edgeCases[3] = 1e77; // Very large number
        edgeCases[4] = 1e50; // Large number
        
        for (uint256 i = 0; i < edgeCases.length; i++) {
            uint256 testValue = edgeCases[i];
            console.log("Testing value:", testValue);
            
            // Test multiplication overflow
            unchecked {
                uint256 result = testValue * 1000;
                bool overflow = (result / 1000 != testValue) || (result < testValue);
                console.log("  Multiplication overflow:", overflow);
                
                // Test addition overflow
                uint256 addResult = testValue + testValue;
                bool addOverflow = addResult < testValue;
                console.log("  Addition overflow:", addOverflow);
            }
        }
        
        console.log("These scenarios demonstrate potential overflow conditions");
        console.log("   that could be exploited if operators set extremely high fees.");
    }
}