import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import * as web3 from "@solana/web3.js";
import { PdaAccount } from "../target/types/pda_account";

async function airdrop(connection: any, address: any, amount = 10_000_000_000) {
    await connection.confirmTransaction(await connection.requestAirdrop(address, amount), "confirmed");
  }

describe("init pda", async () => {
    const provider = anchor.AnchorProvider.local("http://127.0.0.1:8899");
    anchor.setProvider(provider);
  
    const program = anchor.workspace.PdaAccount as Program<PdaAccount>;
  
    const tester = web3.Keypair.generate()
    const payer = web3.Keypair.generate()

    before("Fund the users!", async () => {
        await airdrop(provider.connection, tester.publicKey)
        await airdrop(provider.connection, payer.publicKey)
        console.log("Test user's balance ->", provider.connection.getBalance(tester.publicKey))
        console.log("Payer's balance ->", provider.connection.getBalance(payer.publicKey))
      });

    it("can initialize a pda while story is not over", async () =>{

        // derive pda with seeds
        const [pda] = await web3.PublicKey.findProgramAddressSync(
            [Buffer.from("gamebook_toly"), tester.publicKey.toBuffer()],
            program.programId
          );

        const initialize = await program.methods.initializePda(8)
        .accounts({

            user: tester.publicKey,
            payer: payer.publicKey,

        })
        .signers([payer])
        .rpc({commitment:"confirmed"})

        const txDetails = await provider.connection.getTransaction(initialize, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });

        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log("Transaction details:", txDetails);

    });

    it("rejects initializing a pda when the story is over", async () =>{

        // derive pda with seeds
        const [pda] = await web3.PublicKey.findProgramAddressSync(
            [Buffer.from("gamebook_toly"), tester.publicKey.toBuffer()],
            program.programId
          );
       try{

            const initialize = await program.methods.initializePda(256)
            .accounts({
    
                user: tester.publicKey,
                payer: payer.publicKey,
    
            })
            .signers([payer])
            .rpc({commitment:"confirmed"})
    
            const txDetails = await provider.connection.getTransaction(initialize, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
              });
    
            await new Promise(resolve => setTimeout(resolve, 5000));
            console.log("Transaction details:", txDetails);
            assert.fail("Transaction should have failed");

        } catch (error) {
            // Verify that the error is due to the invalid argument
            assert.include(
                error.message,
                "The value of \"value\" is out of range. It must be >= 0 and <= 255",
                "Expected transaction to fail with u8 range error"
            );  
        } 


    });
});