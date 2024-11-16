import { promises as promise } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import axios from 'axios';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { NFTConfig }  from './utils/interfaces'
import { createNewConnection } from './utils/createSolanaConnection'
import { getFeeInLamports } from './utils/get_fees'
import { 
  ACTIONS_CORS_HEADERS, 
  ActionGetResponse, 
  ActionPostRequest, 
  ActionPostResponse, 
  createPostResponse 
} from '@solana/actions';
import { 
  Connection, 
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  PublicKey, 
  SystemProgram,
  Transaction, 
  TransactionInstruction,
  TransactionSignature,
  Keypair,
} from '@solana/web3.js';
import { MEMO_PROGRAM_ID } from '@solana/spl-memo';
import { Program, Idl, AnchorProvider, setProvider, Wallet } from "@coral-xyz/anchor";
import idl from "../solana/target/idl/pda_account.json";
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, createGenericFile } from '@metaplex-foundation/umi';
import { mplCore, transferV1 } from '@metaplex-foundation/mpl-core';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { keypairIdentity, generateSigner } from '@metaplex-foundation/umi';
import { create, fetchAsset } from '@metaplex-foundation/mpl-core';

/// Load environment variable
dotenv.config();

// Initialize Mint wallet, Program ID and Chapter Count
const MINT = new PublicKey('AXP4CzLGxxHtXSJYh5Vzw9S8msoNR5xzpsgfMdFd11W1')
const PROGRAM_ID = new PublicKey('BLEa4UDmpSn7URDAmmWXhg1KpTKt43Rp7bTeUgo7X3Bz');
let CHAPTER_COUNT: number = 1;

// Initiate RPC connection
//const QUICKNODE_RPC = `https://winter-solemn-sun.solana-mainnet.quiknode.pro/${process.env.QUICKNODE_MAINNET_KEY}/`; // mainnet
const QUICKNODE_RPC = `https://fragrant-ancient-needle.solana-devnet.quiknode.pro/${process.env.QUICKNODE_DEVNET_KEY}/`; // devnet 

// Initialize UMI instance
const newUMI = createUmi(QUICKNODE_RPC)

// Load wallet
function getKeypairFromEnvironment(): Uint8Array {
  const privateKeyString = process.env.MINTER_PRIVATE_KEY;
  if (!privateKeyString) {
    throw new Error('Minter key is not set in environment variables');
  }
  // Convert the private key string to an array of numbers
  const privateKeyArray = privateKeyString.split(',').map(num => parseInt(num, 10));
  // Return a Uint8Array from the array of numbers
  return new Uint8Array(privateKeyArray);
}
const secretKey = getKeypairFromEnvironment()
const payerKeypair = Keypair.fromSecretKey(secretKey);

// Initialize UMI instance with wallet
const keypair = newUMI.eddsa.createKeypairFromSecretKey(new Uint8Array(secretKey))
const umi = newUMI
  .use(mplCore())
  .use(irysUploader({
    address:"https://turbo.ardrive.io"
  }))
  .use(keypairIdentity(keypair));

// Initialize program object
async function initializeProgram(connection): Promise<Program<Idl>> {
  const wallet = new Wallet(payerKeypair);
  const provider = new AnchorProvider(connection, wallet, {});
  setProvider(provider);
  const program = new Program(idl as Idl, provider);
  return program;
}

async function createPda(PROGRAM: Program, user_account: PublicKey, payer: Keypair, chapter: number): Promise<string> {
  try {

    console.log(`Creating PDA for user: ${user_account.toString()}`);

    const chapter_increment =  chapter + 1
    console.log(`Toly's story is progressing to Chapter ${chapter_increment} 📖🧙‍♂️`)

    // Derive the PDA
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("gamebook_toly"), user_account.toBuffer()],
      PROGRAM.programId
    );

    const tx = await PROGRAM.methods
    .initializePda(chapter_increment)
    .accounts({
      user: user_account,
      payer: payer.publicKey,
      pdaAccount: pda,
      systemProgram: SystemProgram.programId,
    })
    .signers([payer])
    .rpc();

    console.log('Transaction signature:', tx);
    console.log('PDA initialized:', pda.toString());
    
    return pda.toString();

  } catch (error) {
    console.error('Error in createPda:', error);
    throw error;
  }
}

///// AI LOGIC
const oai_client = new OpenAI({apiKey: process.env['OPENAI_API_KEY']});
const gpt_llm = "gpt-4o-2024-08-06"

async function consequence(description,playerChoice): Promise<string>{

  const generateStory = await oai_client.chat.completions.create({
    messages: [
        {
            role: "system",
            content: `You are an expert storyteller and narrator for an interactive medieval fantasy gamebook. 
            Your task is to continue the story of Toly, a knight of Solana, in a compelling and engaging manner. 
            Craft your narratives to be vivid yet concise.`
        },
        {
            role: "user",
            content: `
                Based on the following story so far:
                '${description}'
                Toly decided the following:
                '${playerChoice}'
                Please write ONE SENTENCE about the direct consequences of Toly's action on the story.`
        }
    ],
    model: gpt_llm,
    temperature: 0.7,
});

const storyContinues = generateStory.choices[0].message.content;

return storyContinues
}

async function defineConfig(storySoFar: string, choiceConsequence: string): Promise<NFTConfig> {
    try {
        const random_num = Math.random();
        let scene_type: string;

        if (random_num < 0.2) {
            scene_type = "combat";
            console.log(`Let's create a ${scene_type} scene 🖼️`)
        } else if (random_num < 0.4) {
            scene_type = "ominous";
            console.log(`Let's create an ${scene_type} scene 🖼️`)
        } else if (random_num < 0.6) {
            scene_type = "bizarre";
            console.log(`Let's create a ${scene_type} scene 🖼️`)
        } else if (random_num < 0.8) {
            scene_type = "heroic";
            console.log(`Let's create a ${scene_type} scene 🖼️`)
        }

        const nftAttributes = await oai_client.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an expert storyteller and narrator for an interactive medieval fantasy gamebook. Your task is to continue the story of Toly, a knight of Solana, in a compelling and engaging manner. Each scene you create will be turned into an NFT, representing a crucial decision point in Toly's journey. Craft your narratives to be vivid yet concise, always ending with a cliffhanger that presents three distinct choices for the protagonist."
                },
                {
                    role: "user",
                    content: `
                        Based on the following story so far:
                        '${storySoFar}'

                        Generate a JSON object for the next scene in Toly's adventure. Follow these guidelines:

                        1. The "story_continues" should be a brief ${scene_type} scene (maximum 50 words) focused on Toly but narrated in third person. End with a cliffhanger that leads to three choices.
                        2. The "scene_name" should be a short, catchy title for this part of the story (3-5 words).
                        3. Provide three distinct choices for Toly, each reflecting a different approach (6 words maximum):
                           - "logical_choice": A rational, well-thought-out option.
                           - "prudent_choice": A careful, risk-averse option.
                           - "reckless_choice": A bold, potentially dangerous option or an option that starts or continue combat.

                        Return only the JSON object without any additional comments or text. Use the following structure:

                        {
                            "story_continues": "",
                            "scene_name": "",
                            "logical_choice": "",
                            "prudent_choice": "",
                            "reckless_choice": ""
                        }

                        Ensure your response is a valid JSON object that can be parsed without errors.
                    `
                }
            ],
            model: gpt_llm,
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        const llmResponse = JSON.parse(nftAttributes.choices[0]?.message?.content || "{}");

        if (!llmResponse.story_continues || !llmResponse.scene_name || 
            !llmResponse.logical_choice || !llmResponse.prudent_choice || !llmResponse.reckless_choice) {
            throw new Error("Incomplete response from LLM");
        }

        const CONFIG: NFTConfig = {
            uploadPath: './image/',
            imgFileName: `${llmResponse.scene_name.replace(/\s+/g, '-').toLowerCase()}`,
            imgType: 'image/png',
            imgName: llmResponse.scene_name,
            description: `${choiceConsequence} ${llmResponse.story_continues}`,
            imageURI: '',
            attributes: [
                {trait_type: 'Logical Choice', value: llmResponse.logical_choice},
                {trait_type: 'Prudent Choice', value: llmResponse.prudent_choice},
                {trait_type: 'Reckless Choice', value: llmResponse.reckless_choice}
            ],
            properties: {
              files: [
                {
                  uri: '',
                  type: 'image/png',
                },
              ],
              category: 'image',
            },
        };

        return CONFIG;
    } catch (error) {
        console.error("Error in defineConfig:", error);
        throw error;
    }
}

async function createImage(CONFIG: NFTConfig): Promise<string> {
    try {
      // Enhance the prompt for better image generation
      const enhancedPrompt = `Create a medieval fantasy scene depicting: ${CONFIG.description} 
      The protagonist holds a sword and wears a red cape and red metallic helmet that masks his head, body type could be male or female.
      The image should capture the essence of the scene without showing text or specific choices. 
      IMPORTANT: DO NOT GENERATE TEXT.
      Style: Watercolor.`;
  
      const response = await oai_client.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: 'standard'
      });
  
      const imageUrl = response.data[0].url;
      if (!imageUrl) {
        throw new Error("No image URL received from the API");
      }
  
      // Fetch the image from the URL
      const imageResponse = await axios({
        url: imageUrl,
        method: 'GET',
        responseType: 'arraybuffer'
      });
  
      // Use the CONFIG.uploadPath and imgFileName for consistency
      const imagePath = path.join(CONFIG.uploadPath, `${CONFIG.imgFileName}.png`);
  
      // Ensure the directory exists
      fs.mkdirSync(path.dirname(imagePath), { recursive: true });
  
      // Write the image data to a file
      await fs.promises.writeFile(imagePath, imageResponse.data);
  
      return imagePath;
    } catch (error) {
      console.error("Error in createImage:", error);
      throw error;
    }
  }

async function updateConfigWithImageUri(config: NFTConfig, imageUri: string): Promise<NFTConfig> {
  return {
    ...config,
    imageURI: imageUri,
    properties: {
      ...config.properties,
      files: [
        {
          uri: imageUri,
          type: config.imgType,
        },
      ],
    },
  };
}

async function createURI(imagePath: string, CONFIG: NFTConfig): Promise<string> {
  try {
    // Read the image file
    const imageBuffer = await promise.readFile(imagePath);
  
    // Create a GenericFile object
    const umiImageFile = createGenericFile(
      imageBuffer,
      CONFIG.imgFileName,
      {
        displayName: CONFIG.imgName,
        uniqueName: CONFIG.imgFileName,
        contentType: CONFIG.imgType,
        extension: CONFIG.imgFileName.split('.').pop() || 'png',
        tags: [{ name: 'Content-Type', value: CONFIG.imgType }],
      }
    );
  
    // Upload the image and get its URI
    const [imageUri] = await umi.uploader.upload([umiImageFile]);
    if (!imageUri) {
      throw new Error("Failed to upload image");
    }
    console.log('Image uploaded, URI:', imageUri);
  
    // Add the image URI to the config
    const configWithUri = await updateConfigWithImageUri(CONFIG, imageUri)
    console.log(configWithUri)
  
    // Upload the JSON metadata
    const metadataUri = await umi.uploader.uploadJson(configWithUri);
    if (!metadataUri) {
      throw new Error("Failed to upload metadata");
    }
  
    return metadataUri;
  
  } catch (error) {
    console.error("Error in createURI:", error);
    throw error;
  }
  }

  async function createAsset(CONFIG: NFTConfig, uri: string): Promise<string> {
    try {
      // Generate a new signer for the asset
      const assetSigner = generateSigner(umi);
      console.log(`Creating asset with metadata: ${uri}`)
  
      // Create the asset
      await create(umi, {
        asset: assetSigner,
        name: CONFIG.imgName,
        uri: uri,
      }).sendAndConfirm(umi);
  
      console.log(`Asset address: ${assetSigner.publicKey}`);
  
      return assetSigner.publicKey.toString();
    } catch (error) {
      console.error("Error in createAsset:", error);
      throw error;
    }
  }

// Declaring global assetAddress
let assetAddress: string = "9sR9xtvZJ4Af6oE77V8kemCLnJg8zhhLDx9gAZ3WfrQi"; //forest start devnet
//let assetAddress: string = "6mf9AD115ozEWNvkdUqmCDvALan64eXyFjiUkr72KVej"; //forest start on mainnet
let onceUponATime: string = "Toly, the knight of Solana, stood at the edge of the Enchanted Forest, his quest to save the kingdom just beginning.";
  
/////// APP ///////
// Create a new express application instance
const app: express.Application = express();
app.use(cors());
app.use(express.json());

app.get('/get_action', async (req, res) => {
  try {
    if (!assetAddress) {
      throw new Error('Asset address not set');
    }

    // Fetch the asset using the provided UMI instance
    const asset = await fetchAsset(umi, assetAddress);
    console.log(`Fetching asset -> ${asset.uri}`)

    // Fetch the metadata from the asset's URI
    const metadata = await axios.get(asset.uri);
    console.log(`Fetching asset metadata -> ${metadata.data} `)

    // Extract the required information from the metadata
    const { description, attributes, imageURI } = metadata.data;;
    console.log(`Displaying: ${imageURI}`)
    const [choiceOne, choiceTwo, choiceThree] = attributes.map(attr => attr.value);

    const payload: ActionGetResponse = {
      type: 'action',
      icon: imageURI,
      label: "Continue Toly's Journey",
      title: "Toly's Infinite Adventure⚔️",
      description: description,
      links: {
        actions: [
          {
            "type": "transaction",
            "label": choiceOne,
            "href": `http://localhost:8000/post_action?choice=${encodeURIComponent(choiceOne)}`
          },
          {
            "type": "transaction",
            "label": choiceTwo,
            "href": `http://localhost:8000/post_action?choice=${encodeURIComponent(choiceTwo)}`
          },
          {
            "type": "transaction",
            "label": choiceThree,
            "href": `http://localhost:8000/post_action?choice=${encodeURIComponent(choiceThree)}`
          }
        ]
      }
    };

    res.header(ACTIONS_CORS_HEADERS).status(200).json(payload);
  } catch (error) {
    console.error("Error handling GET request:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.options('/post_action', (req: Request, res: Response) => {
  res.header(ACTIONS_CORS_HEADERS).status(200).end();
});

app.post('/post_action', async (req: Request, res: Response) => {
  try {
    
    if (!assetAddress) {
      throw new Error('Asset address is not defined');
    }
    const asset = await fetchAsset(umi, assetAddress);
    const assetUri = asset.uri;
    const response = await axios.get(assetUri);
    const metadata = response.data;
    const { description } = metadata;
    console.log(description);

    const playerChoice = typeof req.query.choice === 'string' 
      ? decodeURIComponent(req.query.choice) 
      : '';
    console.log(playerChoice);
    
    let user_account: PublicKey;
    try {
      const body: ActionPostRequest = req.body;
      user_account = new PublicKey(body.account);
    } catch (error) {
      console.error('Invalid account:', error);
      return res.status(400).json({ error: 'Invalid account' });
    }

    const connection = await createNewConnection(QUICKNODE_RPC);

    // Derive PDA
    const [PDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("gamebook_toly"), user_account.toBuffer()],
      PROGRAM_ID,
    );

    // Check if PDA already exists
    const pdaInfo = await connection.getAccountInfo(PDA);
    if (!pdaInfo) {
      // PDA doesn't exist, create it
      console.log("Creating PDA for user...");
      const program = await initializeProgram(connection)
      const pda_account_address = await createPda(program, user_account, payerKeypair, CHAPTER_COUNT);
      console.log(`PDA account for user created at ${pda_account_address}`);
    } else {
      console.log("PDA already exists for this user");
    }

    const {blockhash} = await connection.getLatestBlockhash();
    console.log(`Latest blockhash: ${blockhash}`)

    const mintingFee = await getFeeInLamports();
    const mintingFeeSOL = mintingFee / LAMPORTS_PER_SOL;
    console.log(`Fee for this transaction -> ${mintingFee} lamports or ${mintingFeeSOL} SOL.`);

    const transaction = new Transaction();
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: user_account,
        toPubkey: MINT,
        lamports: mintingFee,
      })
    );
    const memo = (Math.floor(Math.random() * 100000)).toString();
    // Adding memo
    transaction.add(
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, 'utf-8'),
      })
    );

    // Set computational resources for transaction
    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }))
    transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }))

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = user_account;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        type: 'transaction',
        transaction: transaction,
        message: "The adventure continues! WAIT 2 MINUTES and refresh the page to see what happens next!",
      },
    });

    res.status(200).json(payload);

    processPostTransaction(description, playerChoice, connection, user_account, memo, PDA)

  } catch (error) {
    console.error('An error occurred:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
    // Don't send another response if one has already been sent
    if (!res.headersSent) {
      res.status(500).json({ error: 'An internal server error occurred' });
    }
  }
});

async function findTransactionWithMemo(connection: Connection, userAccount: PublicKey, memo: string): Promise<TransactionSignature | null> {
  const maxChecks = 10;
  let checkCount = 0;

  console.log(`Searching for memo: "${memo}"`);

  while (checkCount < maxChecks) {
    console.log(`Check ${checkCount + 1} of ${maxChecks}`);
    
    const signatures = await connection.getSignaturesForAddress(userAccount, 
      { limit: 5 },
      'confirmed'
    );

    for (const sigInfo of signatures) {
      console.log(`Checking signature: ${sigInfo.signature}`);
      console.log(`Signature memo: "${sigInfo.memo}"`);
      
      if (sigInfo.memo && sigInfo.memo.includes(memo)) {
        console.log("Memo match found!");
        return sigInfo.signature;
      } else {
        console.log("No match");
      }
    }

    checkCount++;

    if (checkCount < maxChecks) {
      console.log("Waiting 5 seconds before next check...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log("Maximum checks reached, no matching memo found");
  return null;
}

async function processPostTransaction(description: string, playerChoice: string, connection: Connection, user_account:PublicKey, memo:string, pda: PublicKey) {

  const transactionSignature = await findTransactionWithMemo(connection, user_account, memo);

  if (transactionSignature) {
    console.log(`Found transaction with memo: ${transactionSignature}`);

    try {
      const choiceConsequence = await consequence(description, playerChoice);
      console.log(choiceConsequence);
      const continueStory = `${onceUponATime}\n\n${choiceConsequence}`;
  
      console.log("Defining config for the new scene...");
      const CONFIG = await defineConfig(continueStory, choiceConsequence);
      console.log("Config defined:", CONFIG);
  
      console.log("Creating image...");
      const imagePath = await createImage(CONFIG);
      console.log("Image created at:", imagePath);
  
      console.log("Creating URI 🔗 ...");
      const uri = await createURI(imagePath, CONFIG);
      console.log("Metadata URI created:", uri);
  
      console.log("Creating asset ⛏️ ...");
      const newAssetAddress = await createAsset(CONFIG, uri);

      // Update the global assetAddress with the new asset address
      assetAddress = newAssetAddress;
      CHAPTER_COUNT += 1;
      console.log("Global assetAddress updated to:", assetAddress);
      console.log("Chapter count updated to:", CHAPTER_COUNT);

      // Transfer asset to PDA
      await transferNFTToPDA(new PublicKey(newAssetAddress), pda);
  
      fs.unlink(imagePath, (err) => {
        if (err) {
          console.error('Failed to delete the local image file:', err);
        } else {
          console.log(`Local image file deleted successfully 🗑️`);
        }
      });
    
      console.log("Process completed successfully!");
    } catch (error) {
      console.error("An error occurred in the post-transaction process:", error);
      throw error;
    }
  }else{
    console.log("Oops, couldn't find the transaction!")
  }
}

async function transferNFTToPDA(newAssetAddress: PublicKey, pdaAddress: PublicKey) {
  try {

    const asset = await fetchAsset(umi, newAssetAddress.toString())

    const result = await transferV1(umi, {
      asset:publicKey(asset),
      newOwner: publicKey(pdaAddress.toString()),
    })
    .sendAndConfirm(umi);

    console.log(`NFT transferred to PDA: ${pdaAddress}`);
    return result.signature;
  } catch (error) {
    console.log('Error transferring NFT to PDA!');
  }
}

// Initialize port and start dev server
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 8000;
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/`);
  console.log(`Test your blinks http://localhost:${port}/get_action \n at https://www.dial.to/`)
});

export default app;