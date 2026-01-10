// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMerkleNullifierVerifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata input  // [nullifier, rootExpected, context]
    ) external view returns (bool);
}

contract MerkleNullifierClaim {
    IMerkleNullifierVerifier public verifier;

    uint256 public merkleRoot;
    mapping(uint256 => bool) public nullifierUsed;

    event Claimed(uint256 nullifier, address claimer);

    constructor(address _verifier, uint256 _root) {
        verifier = IMerkleNullifierVerifier(_verifier);
        merkleRoot = _root;
    }

    function claim(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[3] calldata input  // [nullifier, rootExpected, context]
    ) external {
        require(verifier.verifyProof(a, b, c, input), "Invalid proof");

        // Public signals order: [nullifier, rootExpected, context]
        uint256 nullifier = input[0];
        uint256 rootExpected = input[1];

        require(rootExpected == merkleRoot, "Wrong root");
        require(!nullifierUsed[nullifier], "Nullifier already used");

        nullifierUsed[nullifier] = true;
        emit Claimed(nullifier, msg.sender);

        // Here is where you'd mint/transfer/etc.
    }
}
