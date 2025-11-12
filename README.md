# M-Pesa Credit Proof

A zero-knowledge proof system that enables Kenyan businesses to prove their creditworthiness using M-Pesa transaction data without revealing sensitive customer information or individual transaction details.

## What It Does

M-Pesa Credit Proof uses RISC Zero's zkVM to generate cryptographic proofs of business creditworthiness. Businesses can share verifiable credit scores with lenders while keeping their transaction data private.

Traditional credit assessment requires sharing raw transaction data, exposing customer information and business patterns. This system allows businesses to prove creditworthiness cryptographically without exposing any raw data.

## How It Uses RISC Zero

The project uses RISC Zero's zkVM to execute credit score calculations in a verifiable, privacy-preserving manner.

### Architecture

1. **Guest Code** (`methods/guest/src/main.rs`) - Runs inside the zkVM
   - Processes M-Pesa transactions
   - Calculates business metrics (volume, consistency, growth, diversity)
   - Computes credit scores (0-100)
   - All computation happens in a verifiable, private environment

2. **Host Code** (`api/src/services/proof.rs`) - Orchestrates proof generation
   - Prepares transaction data as input to the zkVM
   - Executes proof generation using RISC Zero's prover
   - Verifies the cryptographic receipt
   - Stores proof results

3. **API & Frontend** - User interface for uploading data and managing proofs

### Proof Flow

1. Business uploads M-Pesa transactions
2. Transactions are prepared as input for zkVM
3. Guest code executes inside RISC Zero zkVM, calculating metrics and credit score
4. RISC Zero generates cryptographic receipt
5. Receipt is verified and stored
6. Business receives proof with verification code
7. Lenders can verify proof without seeing transaction data

### What Gets Proven

The zkVM guest code calculates and proves:
- Credit Score (0-100)
- Monthly Volume Range
- Consistency Score
- Growth Trend
- Active Days Percentage
- Customer Diversity Score

### What Stays Private

Lenders never see:
- Individual transaction amounts
- Customer phone numbers
- Transaction references
- Specific transaction timestamps
- Raw transaction data


## Resources

- [RISC Zero Developer Docs](https://dev.risczero.com)
- [RISC Zero zkVM Overview](https://dev.risczero.com/zkvm)
- [RISC Zero Examples](https://github.com/risc0/risc0/tree/main/examples)
