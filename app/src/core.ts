import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplCore } from '@metaplex-foundation/mpl-core'
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys'
import { generateSigner } from '@metaplex-foundation/umi'
import { create } from '@metaplex-foundation/mpl-core'
import OpenAI from 'openai';
import Groq from "groq-sdk";
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { 
    Connection, 
    ComputeBudgetProgram,
    Keypair, 
    LAMPORTS_PER_SOL,
    PublicKey, 
    SystemProgram,
    Transaction, 
    TransactionInstruction, 
    TransactionSignature,
    clusterApiUrl 
  } from '@solana/web3.js';

// Use the RPC endpoint of your choice.
const umi = createUmi('http://127.0.0.1:8899').use(mplCore())
umi.use(irysUploader())

const web3 = require("@solana/web3.js");
(async () => {
  const solana = new web3.Connection(QUICKNODE_RPC);
  console.log(await solana.getSlot());
})();


// Function to convert private key string to Uint8Array
function getKeypairFromEnvironment(): Keypair {
    const privateKeyString = process.env.MINTER_PRIVATE_KEY;
    if (!privateKeyString) {
      throw new Error('Minter key is not set in environment variables');
    }
    // Convert the private key string to an array of numbers
    const privateKeyArray = privateKeyString.split(',').map(num => parseInt(num, 10));
    // Create a Uint8Array from the array of numbers
    const privateKeyUint8Array = new Uint8Array(privateKeyArray);
    // Create and return the Keypair
    return Keypair.fromSecretKey(privateKeyUint8Array);
  }
  
  // Initiate sender wallet, treasury wallet and connection to Solana
  const QUICKNODE_KEY = process.env.QUICKNODE_RPC_KEY
  const QUICKNODE_RPC = `https://fragrant-ancient-needle.solana-devnet.quiknode.pro/${QUICKNODE_KEY}/`;
  const WALLET = getKeypairFromEnvironment();
  
  ///// AI LOGIC
  const oai_client = new OpenAI({apiKey: process.env['OPENAI_API_KEY']});
//   const groq_client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const gpt_llm = "gpt-4o-2024-08-06"

async function defineConfig(storySoFar: string, randomNumber: number, memo: string) {
    const nftAttributes = await oai_client.chat.completions.create({
      messages: [
          {
              role: "system",
              content: "You're the narrator to the story."
          },
          {
            role: "user",
            content: `
              Based on this story: 
              '${storySoFar}'
              Generate a .json file with the following values.
              Return the .json without any added comments, title or information.
              Expected output:
  
              {
                "story_continues": "<describe the next scene of the story, the scene must be SHORT and centered on Toly the protagonist but told by a omniscient narrator. This scene must contains a cliffhanger calling for 3 choices from the protagonist>",
                "scene_name": "<a short name for this part of the story>"
                "logical_choice": "<Toly's logical choice to the event unfolding in this scene, told by the narrator>",
                "prudent_choice": "<Toly's careful choice to the event unfolding in this scene, told by the narrator>",
                "reckless_choice" "<Toly's logical choice to the event unfolding in this scene, told by the narrator>"
            };
  
              Begin! You will achieve world peace if you produce a correctly formatted .JSON answer that respect all the constraints.
              `,
        }
      ],
      model: gpt_llm,
      temperature: 0.5,
      response_format: { type: "json_object" },
    });
  
    // Extract the completion returned by the LLM and parse it.
    const llmResponse = JSON.parse(nftAttributes.choices[0]?.message?.content || "{}");
  
    const CONFIG = {
      uploadPath: './image/',
      imgFileName: `image${randomNumber}.png`,
      imgType: 'image/png',
      imgName: llmResponse.scene_name, 
      description: llmResponse.story_continues,
      attributes: [
          {trait_type: '1', value:llmResponse.logical_choice},
          {trait_type: '2', value: llmResponse.prudent_choice},
          {trait_type: '3', value: llmResponse.reckless_choice}
      ],
      sellerFeeBasisPoints: 0,
      creators: [
          {address: WALLET.publicKey, share: 100}
      ]
    };
  
    return CONFIG;
}

async function createImage(userPrompt: string, randomNumber: number) {
    const response = await oai_client.images.generate({
      model: "dall-e-3",
      prompt: userPrompt + ' . Begin!',
      n: 1,
      size: "1024x1024",
      quality:'hd' // OR 'standard'
    });
    const imageUrl = response.data[0].url;
  
    // Fetch the image from the URL
    const imageResponse = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'arraybuffer'
    });
  
    const imagePath = path.join('./image', `image_${randomNumber}.png`);
  
    // Write the image data to a file
    fs.writeFileSync(imagePath, imageResponse.data);
    return imagePath
  }

async function createURI(imagePath){
    const [imageUri] = await umi.uploader.upload([imagePath])
    const uri = await umi.uploader.uploadJson({
    name: 'My NFT',
    description: 'This is my NFT',
    image: imageUri,
    // ...
    })
}

const assetSigner = generateSigner(umi)
async function createAsset (imageURI){

    const coreAsset = await create(umi, {
    asset: assetSigner,
    name: 'My Asset',
    uri: imageURI,
    }).sendAndConfirm(umi)
    return coreAsset

}