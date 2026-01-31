// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/SSVAnalysis.sol";

contract DiscoverOperatorsScript is Script {
    ISSVNetwork constant SSV = ISSVNetwork(0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1);
    
    function run() external {
        console.log("=== SSV Network Operator Discovery ===");
        console.log("Scanning for active operators...");
        console.log("");
        
        uint256 activeOperators = 0;
        uint256[] memory operatorIds = new uint256[](50);
        uint256[] memory fees = new uint256[](50);
        
        // Scan a wider range to find active operators
        for (uint256 i = 1; i <= 10000; i++) {
            try SSV.getOperatorFee(i) returns (uint256 fee) {
                // Try to get more details to verify it's a real operator
                try SSV.operators(i) returns (
                    address owner,
                    bytes32 snapshot,
                    uint256 operatorFee,
                    address recipientAddress,
                    bool active
                ) {
                    if (active && owner != address(0)) {
                        console.log("Found active operator", i);
                        console.log("  Owner:", owner);
                        console.log("  Fee (wei):", operatorFee);
                        console.log("  Fee (ETH):", operatorFee / 1e18);
                        console.log("  Recipient:", recipientAddress);
                        console.log("");
                        
                        if (activeOperators < 50) {
                            operatorIds[activeOperators] = i;
                            fees[activeOperators] = operatorFee;
                            activeOperators++;
                        }
                    }
                } catch {
                    // Operator exists but might have different interface
                    if (fee > 0) {
                        console.log("Found operator with fee:", i);
                        console.log("  Fee:", fee);
                        if (activeOperators < 50) {
                            operatorIds[activeOperators] = i;
                            fees[activeOperators] = fee;
                            activeOperators++;
                        }
                    }
                }
            } catch {
                // Operator doesn't exist or call failed
                continue;
            }
            
            // Stop after finding enough operators or scanning enough
            if (activeOperators >= 50 || i % 1000 == 0) {
                console.log("Scanned up to operator:", i);
                console.log("Found active operators:", activeOperators);
                if (activeOperators >= 50) break;
            }
        }
        
        console.log("=== DISCOVERY SUMMARY ===");
        console.log("Total active operators found:", activeOperators);
        
        if (activeOperators > 0) {
            // Analyze the discovered operators
            analyzeDiscoveredOperators(operatorIds, fees, activeOperators);
        }
    }
    
    function analyzeDiscoveredOperators(
        uint256[] memory operatorIds, 
        uint256[] memory fees,
        uint256 count
    ) internal {
        console.log("");
        console.log("=== ANALYZING DISCOVERED OPERATORS FOR OVERFLOW RISKS ===");
        
        uint256 highestFee = 0;
        uint256 highestFeeOperator = 0;
        uint256 totalFeesSum = 0;
        uint256 riskCount = 0;
        
        for (uint256 i = 0; i < count; i++) {
            uint256 operatorId = operatorIds[i];
            uint256 fee = fees[i];
            
            totalFeesSum += fee;
            
            if (fee > highestFee) {
                highestFee = fee;
                highestFeeOperator = operatorId;
            }
            
            // Check for potential overflow risks
            bool riskDetected = false;
            
            // Test multiplication overflow scenarios
            unchecked {
                // Common operations that might be vulnerable:
                // 1. Fee * time_period
                uint256 yearInSeconds = 365 * 24 * 60 * 60; // ~31.5M
                uint256 result1 = fee * yearInSeconds;
                bool overflowYearly = (result1 / yearInSeconds != fee);
                
                // 2. Fee * large_multiplier (e.g., for calculations)
                uint256 result2 = fee * 1e18; // ETH conversion
                bool overflowETH = (fee != 0 && result2 / 1e18 != fee);
                
                // 3. Fee squared for interest calculations
                uint256 result3 = fee * fee;
                bool overflowSquare = (fee != 0 && result3 / fee != fee);
                
                if (overflowYearly || overflowETH || overflowSquare) {
                    riskDetected = true;
                    riskCount++;
                    
                    console.log("OVERFLOW RISK DETECTED - Operator", operatorId);
                    console.log("  Fee:", fee);
                    console.log("  Yearly calculation overflow:", overflowYearly);
                    console.log("  ETH conversion overflow:", overflowETH);
                    console.log("  Square calculation overflow:", overflowSquare);
                    console.log("");
                }
            }
        }
        
        console.log("=== RISK ANALYSIS RESULTS ===");
        console.log("Total operators analyzed:", count);
        console.log("Highest fee found:", highestFee);
        console.log("Highest fee operator ID:", highestFeeOperator);
        console.log("Average fee:", count > 0 ? totalFeesSum / count : 0);
        console.log("Operators with overflow risks:", riskCount);
        
        if (riskCount > 0) {
            console.log("");
            console.log("CRITICAL: Found operators with potential overflow vulnerabilities!");
            console.log("These operators could be exploited through integer overflow attacks.");
            
            // Calculate potential financial impact
            console.log("");
            console.log("=== FINANCIAL IMPACT ASSESSMENT ===");
            calculateFinancialImpact(highestFee, totalFeesSum, count);
        } else {
            console.log("");
            console.log("No immediate overflow risks detected in current operator fees.");
        }
    }
    
    function calculateFinancialImpact(
        uint256 highestFee,
        uint256 totalFees,
        uint256 operatorCount
    ) internal view {
        console.log("Highest single operator fee:", highestFee, "wei");
        console.log("Highest fee in ETH:", highestFee / 1e18);
        console.log("Total fees across operators:");
        console.log("  Operator count:", operatorCount);
        console.log("  Total fees (ETH):", totalFees / 1e18);
        
        // Estimate potential exploit scenarios
        if (highestFee > 0) {
            // Scenario 1: Time-based fee calculation overflow
            uint256 secondsInYear = 365 * 24 * 60 * 60;
            unchecked {
                uint256 yearlyFee = highestFee * secondsInYear;
                if (yearlyFee / secondsInYear != highestFee) {
                    console.log("Yearly fee calculation would overflow for highest fee operator");
                    console.log("This could allow fee manipulation or denial of service");
                }
            }
            
            // Scenario 2: Large multiplier overflow
            unchecked {
                uint256 scaledFee = highestFee * 1e18;
                if (highestFee != 0 && scaledFee / 1e18 != highestFee) {
                    console.log("Fee scaling operations would overflow");
                    console.log("This could break fee calculations and payment systems");
                }
            }
        }
    }
}