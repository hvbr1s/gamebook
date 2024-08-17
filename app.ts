// Node.js built-in modules
import { promises as promise } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
// Third-party modules
import dotenv from 'dotenv';
import OpenAI from 'openai';
import axios from 'axios';
import fetch from 'node-fetch';
import cors from 'cors';
import express, { Request, Response } from 'express';
// Solana-related imports
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
} from '@solana/web3.js';
// Metaplex-related imports
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { keypairIdentity, generateSigner, GenericFile } from '@metaplex-foundation/umi';
import { create, fetchAsset } from '@metaplex-foundation/mpl-core';

/// Load environment variable
dotenv.config();

// Initiate sender wallet, treasury wallet and connection to Solana
const QUICKNODE_KEY = process.env.QUICKNODE_RPC_KEY
const QUICKNODE_RPC = `https://fragrant-ancient-needle.solana-devnet.quiknode.pro/${QUICKNODE_KEY}/`;

// Initialize UMI instance
const newUMI = createUmi(QUICKNODE_RPC)

// Load wallet
const WALLET_PATH = '/home/dan/gamebook/secrets/GBWKj4a6Yo18U4ZXNHm5VRe6JUHCvzm5UzaargeZRc9Z.json'
const secretKey = JSON.parse(fs.readFileSync(WALLET_PATH, 'utf-8'))
const keypair = newUMI.eddsa.createKeypairFromSecretKey(new Uint8Array(secretKey))

// Initialize UMI instance with wallet
const umi = newUMI
  .use(mplCore())
  .use(irysUploader())
  .use(keypairIdentity(keypair));

async function createNewConnection(rpcUrl: string){
  const connection = await new Connection(rpcUrl)
  console.log(`Connection to Solana established`)
  return connection;
}

// Fee setting function
async function getFeeInLamports(connection: Connection): Promise<number> {
  // 1. Get the current SOL/USD price
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
  const data = await response.json();
  const solPrice = data.solana.usd;

  // 2. Calculate SOL equivalent of 5 USD
  const solAmount = 5 / solPrice;

  // 3. Convert SOL to lamports
  const lamports = solAmount * LAMPORTS_PER_SOL;

  // Round to the nearest whole number of lamports
  return Math.round(lamports);
}

///// AI LOGIC
const oai_client = new OpenAI({apiKey: process.env['OPENAI_API_KEY']});

const gpt_llm = "gpt-4o-2024-08-06"

  interface NFTConfig {
    uploadPath: string;
    imgFileName: string;
    imgType: string;
    imgName: string;
    description: string;
    attributes: Array<{trait_type: string, value: string}>;
}

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
                Please write the consequences of Toly's action on the story.
            `
        }
    ],
    model: gpt_llm,
    temperature: 0.7,
});

const storyContinues = generateStory.choices[0].message.content;

return storyContinues
}

async function defineConfig(storySoFar: string): Promise<NFTConfig> {
    try {
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

                        1. The "story_continues" should be a brief, engaging scene (50-100 words) focused on Toly but narrated in third person. End with a cliffhanger that leads to three choices.
                        2. The "scene_name" should be a short, catchy title for this part of the story (3-5 words).
                        3. Provide three distinct choices for Toly, each reflecting a different approach:
                           - "logical_choice": A rational, well-thought-out option.
                           - "prudent_choice": A careful, risk-averse option.
                           - "reckless_choice": A bold, potentially dangerous option.

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
            description: llmResponse.story_continues,
            attributes: [
                {trait_type: 'Logical Choice', value: llmResponse.logical_choice},
                {trait_type: 'Prudent Choice', value: llmResponse.prudent_choice},
                {trait_type: 'Reckless Choice', value: llmResponse.reckless_choice}
            ]
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
      The image should capture the essence of the scene WITHOUT showing text or specific choices. Style: Watercolor.`;
  
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
      console.log(imagePath)
  
      return imagePath;
    } catch (error) {
      console.error("Error in createImage:", error);
      throw error;
    }
  }

  interface UriConfig extends NFTConfig {
    imageURI: string;
}
  

async function createURI(imagePath: string, CONFIG: NFTConfig): Promise<string> {
  try {
    // Read the image file
    const imageBuffer = await promise.readFile(imagePath);

    // Create a GenericFile object
    const imageFile: GenericFile = {
      buffer: imageBuffer,
      fileName: CONFIG.imgFileName,
      displayName: CONFIG.imgName,
      uniqueName: CONFIG.imgFileName,
      contentType: CONFIG.imgType,
      extension: 'png',
      tags: [],
    };

    // Upload the image and get its URI
    const [imageUri] = await umi.uploader.upload([imageFile]);
    if (!imageUri) {
      throw new Error("Failed to upload image");
    }

    // Add the image URI to the config
    const configWithUri: UriConfig = {
      ...CONFIG,
      imageURI: imageUri,
    };

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

const assetSigner = generateSigner(umi)

async function createAsset(CONFIG: UriConfig): Promise<string> {
  try {
    // Generate a new signer for the asset
    const assetSigner = generateSigner(umi);

    // Create the asset
    const result = await create(umi, {
      asset: assetSigner,
      name: CONFIG.imgName,
      uri: CONFIG.imageURI,
    }).sendAndConfirm(umi);

    console.log(`Asset created with signature: ${result.signature}`);
    console.log(`Asset address: ${assetSigner.publicKey}`);

    return assetSigner.publicKey.toString();
  } catch (error) {
    console.error("Error in createAsset:", error);
    throw error;
  }
}

async function goFetch(assetAddress) {
  try {
    // Fetch the asset using the provided UMI instance
    const asset = await fetchAsset(umi, assetAddress, {
      skipDerivePlugins: false,
    });

    // Get the asset's URI
    const assetLocation = asset.uri;

    // Fetch the metadata from the asset's URI
    const response = await axios.get(assetLocation);
    
    // Extract the imageURI from the metadata
    const foundIt = response.data.imageURI;

    return foundIt;
  } catch (error) {
    console.error('Error in goFetch:', error);
    throw error;
  }
}

// Declaring global assetAddress
let assetAddress: string = "2A2LMNeBucYBHteoa9GiFHRggRhJBBLzaetzpSHvTCT3";
let onceUponATime: string = "Toly, the knight of Solana, stood at the edge of the Enchanted Forest, his quest to save the kingdom just beginning.";
  
/////// APP ///////
// Create a new express application instance
const app: express.Application = express();
app.use(cors());

app.get('/get_action', async (req, res) => {
  try {
    if (!assetAddress) {
      throw new Error('Asset address not set');
    }

    // Fetch the asset using the provided UMI instance
    const asset = await fetchAsset(umi, assetAddress);

    // Get the asset's URI
    const assetUri = asset.uri;

    // Fetch the metadata from the asset's URI
    const response = await axios.get(assetUri);
    const metadata = response.data;

    // Extract the required information from the metadata
    const { description, attributes } = metadata;
    const [choiceOne, choiceTwo, choiceThree] = attributes.map(attr => attr.value);

    const payload: ActionGetResponse = {
      icon: new URL(metadata.imageURI).toString(),
      label: "Continue Journey",
      title: "Toly's Adventure",
      description: description,
      links: {
        actions: [
          {
            "label": choiceOne,
            "href": `http://localhost:8000/post_action?choice=${encodeURIComponent(choiceOne)}`
          },
          {
            "label": choiceTwo,
            "href": `http://localhost:8000/post_action?choice=${encodeURIComponent(choiceTwo)}`
          },
          {
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

app.use(express.json());
app.post('/post_action', async (req: Request, res: Response) => {
  try {
    // Fetch the asset using the provided UMI instance
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
      console.log(user_account);
    } catch (error) {
      console.error('Invalid account:', error);
      return res.status(400).json({ error: 'Invalid account' });
    }

    const connection = await createNewConnection(QUICKNODE_RPC);
    const transaction = new Transaction();

    const { blockhash } = await connection.getLatestBlockhash();
    const mintingFee = await getFeeInLamports(connection);
    const mintingFeeSOL = mintingFee / LAMPORTS_PER_SOL;
    console.log(`Fee for this transaction -> ${mintingFee} lamports or ${mintingFeeSOL} SOL.`);

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: user_account,
        toPubkey: new PublicKey('GBWKj4a6Yo18U4ZXNHm5VRe6JUHCvzm5UzaargeZRc9Z'),
        lamports: mintingFee,
      })
    );

    transaction.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
    transaction.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }));

    transaction.recentBlockhash = blockhash;
    transaction.feePayer = user_account;

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction: transaction,
        message: "The adventure continues!",
      },
    });

    res.status(200).json(payload);

    const signature = await connection.sendRawTransaction(transaction.serialize());
    console.log('Transaction sent. Signature:', signature);

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    console.log('Transaction confirmed. Proceeding with the next steps...');

    await processPostTransaction(description, playerChoice);

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

async function processPostTransaction(description: string, playerChoice: string) {
  try {
    const choiceConsequence = await consequence(description, playerChoice);
    console.log(choiceConsequence);
    const continueStory = onceUponATime + choiceConsequence;

    console.log("Defining config for the new scene...");
    const CONFIG = await defineConfig(continueStory);
    console.log("Config defined:", CONFIG);

    console.log("Creating image...");
    const imagePath = await createImage(CONFIG);
    console.log("Image created at:", imagePath);

    console.log("Creating URI...");
    const imageFile = { uri: imagePath, name: CONFIG.imgFileName, extension: 'png' };
    const uri = await createURI(imagePath, CONFIG);
    console.log("Metadata URI created:", uri);

    console.log("Creating asset...");
    const uriConfig: UriConfig = { ...CONFIG, imageURI: uri };
    const newAssetAddress = await createAsset(uriConfig);
    const assetURL = uriConfig.imageURI;
    console.log("Asset created with address:", newAssetAddress);
    console.log("Asset URL:", assetURL);

    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error('Failed to delete the local image file:', err);
      } else {
        console.log(`Local image file deleted successfully 🗑️`);
      }
    });

    const seeAsset = await goFetch(newAssetAddress);
    console.log(seeAsset);

    console.log("Process completed successfully!");
  } catch (error) {
    console.error("An error occurred in the post-transaction process:", error);
    throw error; // Re-throw the error to be caught by the main try-catch block
  }
}

// Initialize port and start dev server
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 8000;
app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/`);
  console.log(`Test your blinks http://localhost:${port}/get_action \n at https://www.dial.to/devnet`)
});

export default app;