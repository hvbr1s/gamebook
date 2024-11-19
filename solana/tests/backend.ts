import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { PdaAccount } from "../target/types/pda_account";
import * as path from 'path';
import * as fs from 'fs';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccount, getAssociatedTokenAddressSync, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

async function airdrop(connection: any, address: any, amount = 10_000_000_000) {
    await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
  }

describe("level-4", async () => {
    const provider = anchor.AnchorProvider.env();

    anchor.setProvider(provider);
  
    const program = anchor.workspace.PdaAccount as Program<PdaAccount>;
  
    const newMember = web3.Keypair.generate()

    before("Fund the users!", async () => {
        await airdrop(provider.connection, newMember.publicKey)
      });

    it("can initialize a pda", async () =>{

        const initialize = await program.methods.initializePda() // TO DO

    });
});