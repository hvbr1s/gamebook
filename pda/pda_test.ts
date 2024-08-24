import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from '@solana/web3.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const QUICKNODE_RPC = `https://fragrant-ancient-needle.solana-devnet.quiknode.pro/${process.env.QUICKNODE_DEVNET_KEY}/`;

const programId = new PublicKey("3rYZg5TUpYYnvtVgbPhuMzdfb2hCGyxokD4veAanrkHf");
const seed = "gamebook";

const [PDA, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from(seed)],
  programId,
);

console.log(`PDA: ${PDA}`);
console.log(`Bump: ${bump}`);

// Function to get keypair from environment
function getKeypairFromEnvironment(): Keypair {
  const privateKeyString = process.env.MINTER_PRIVATE_KEY;
  if (!privateKeyString) {
    throw new Error('Minter key is not set in environment variables');
  }
  const privateKeyArray = privateKeyString.split(',').map(num => parseInt(num, 10));
  return Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
}

async function createPDAAccount() {
  // Initialize connection to the network
  const connection = new Connection(QUICKNODE_RPC, "confirmed");

  // Get the keypair from the environment
  const feePayer = getKeypairFromEnvironment();

  console.log(`Fee payer: ${feePayer.publicKey.toBase58()}`);

  // Create the instruction to create the account
  const lamports = await connection.getMinimumBalanceForRentExemption(0);
  const createAccountInstruction = SystemProgram.createAccountWithSeed({
    fromPubkey: feePayer.publicKey,
    newAccountPubkey: PDA,
    basePubkey: feePayer.publicKey,
    seed: seed,
    lamports,
    space: 0,
    programId,
  });

  // Create and send the transaction
  const transaction = new Transaction().add(createAccountInstruction);
  const signature = await sendAndConfirmTransaction(connection, transaction, [feePayer]);

  console.log(`Transaction signature: ${signature}`);
  console.log(`PDA account created at: ${PDA.toBase58()}`);
}

// Call the function to create the PDA account
createPDAAccount().catch(console.error);