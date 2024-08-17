import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplCore } from '@metaplex-foundation/mpl-core'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { keypairIdentity } from '@metaplex-foundation/umi'
import { generateSigner, GenericFile } from '@metaplex-foundation/umi'
import { create } from '@metaplex-foundation/mpl-core'
import dotenv from 'dotenv';
import OpenAI from 'openai';
// import Groq from "groq-sdk";
import axios from 'axios';
import { promises as promise } from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { 
    Keypair, 
    PublicKey, 
  } from '@solana/web3.js';

// Load environment variable
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

///// AI LOGIC
  const oai_client = new OpenAI({apiKey: process.env['OPENAI_API_KEY']});
//   const groq_client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const gpt_llm = "gpt-4o-2024-08-06"

  interface NFTConfig {
    uploadPath: string;
    imgFileName: string;
    imgType: string;
    imgName: string;
    description: string;
    attributes: Array<{trait_type: string, value: string}>;
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
      The image should capture the essence of the scene without showing text or specific choices. Style: Watercolor.`;
  
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

  async function main() {
    try {
      // Initial story setup
      const initialStory = "Toly, the knight of Solana, stood at the edge of the Enchanted Forest, his quest to save the kingdom just beginning.";
  
      // Step 1: Define the config for the new scene
      console.log("Defining config for the new scene...");
      const CONFIG = await defineConfig(initialStory);
      console.log("Config defined:", CONFIG);
  
      // Step 2: Create the image
      console.log("Creating image...");
      const imagePath = await createImage(CONFIG);
      console.log("Image created at:", imagePath);
  
      // Step 3: Create URI (upload image and metadata)
      console.log("Creating URI...");
      const imageFile = { uri: imagePath, name: CONFIG.imgFileName, extension: 'png' };
      const uri = await createURI(imagePath, CONFIG);
      console.log("Metadata URI created:", uri);
  
      // Step 4: Create the asset (mint the NFT)
      console.log("Creating asset...");
      const uriConfig: UriConfig = { ...CONFIG, imageURI: uri };
      const assetAddress = await createAsset(uriConfig);
      console.log("Asset created with address:", assetAddress);
  
      console.log("Process completed successfully!");
    } catch (error) {
      console.error("An error occurred in the main process:", error);
    }
  }
  
  // Run the main function
  main().then(() => console.log("Main function executed")).catch(console.error);