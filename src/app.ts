import * as fs from "node:fs";
import { promises as fsAsync } from "node:fs";
import * as path from "node:path";
import dotenv from 'dotenv'
import axios from "axios";
import OpenAI from "openai";
import { createUmi, keypairIdentity, generateSigner, GenericFile } from "@metaplex-foundation/umi";
import { mplCore, create, fetchAsset } from "@metaplex-foundation/mpl-core";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { web3JsRpc } from "@metaplex-foundation/umi-rpc-web3js";
import { createDefaultProgramRepository } from "@metaplex-foundation/umi-program-repository";
import { z } from "zod";

dotenv.config()

const {
  QUICKNODE_MAINNET_KEY,
  QUICKNODE_DEVNET_KEY,
  OPENAI_API_KEY,
  WALLET_PATH = "./wallet.json",
  NETWORK = "mainnet",
} = process.env as Record<string, string>;

if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY in env");
if (!QUICKNODE_MAINNET_KEY && !QUICKNODE_DEVNET_KEY)
  throw new Error("Missing QuickNode keys in env");

const QUICKNODE_RPC =
  NETWORK === "mainnet"
    ? `https://winter-solemn-sun.solana-mainnet.quiknode.pro/${QUICKNODE_MAINNET_KEY}/`
    : `https://fragrant-ancient-needle.solana-devnet.quiknode.pro/${QUICKNODE_DEVNET_KEY}/`;

//----------------------------------
// Umi setup
//----------------------------------

const umi = createUmi()
  .use(web3JsRpc(QUICKNODE_RPC));
  umi.programs = createDefaultProgramRepository(umi);
  umi.use(mplCore())
  .use(irysUploader());
const secretKey = new Uint8Array(
  JSON.parse(fs.readFileSync(WALLET_PATH, "utf8")) as number[]
);
const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
umi.use(keypairIdentity(keypair));

//----------------------------------
// Types & schemas
//----------------------------------

interface Attribute {
  trait_type: string;
  value: string;
}

interface NftConfig {
  uploadPath: string;
  imgFileName: string;
  imgType: "image/png";
  imgName: string;
  description: string;
  attributes: Attribute[];
}

interface UriConfig extends NftConfig {
  imageURI: string;
}

const SceneSchema = z.object({
  story_continues: z.string().min(10),
  scene_name: z.string().min(3),
  logical_choice: z.string().min(1).max(50),
  prudent_choice: z.string().min(1).max(50),
  reckless_choice: z.string().min(1).max(50),
});

//----------------------------------
// OpenAI client
//----------------------------------

const oai = new OpenAI({ apiKey: OPENAI_API_KEY });
const GPT_MODEL = "gpt-4.1";

//----------------------------------
// Helpers
//----------------------------------

const logger = {
  info: console.log.bind(console, "[INFO]"),
  error: console.error.bind(console, "[ERROR]"),
};

function toSlug(str: string) {
  return str.trim().toLowerCase().replace(/\s+/g, "-");
}

//----------------------------------
// Story generation
//----------------------------------

async function defineConfig(storySoFar: string): Promise<NftConfig> {
  const completion = await oai.chat.completions.create({
    model: GPT_MODEL,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert storyteller and narrator for an interactive medieval fantasy gamebook. Your task is to continue the story of Toly, a knight of Solana, in a compelling and engaging manner. Each scene you create will be turned into an NFT, representing a crucial decision point in Toly's journey. Craft your narratives to be vivid yet concise, always ending with a cliffhanger that presents three distinct choices for the protagonist.",
      },
      {
        role: "user",
        content: `Based on the following story so far:\n'${storySoFar}'\n\nGenerate the next scene JSON using the exact structure and constraints previously described.`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = SceneSchema.safeParse(JSON.parse(raw));

  if (!parsed.success) {
    logger.error("LLM response validation failed", parsed.error);
    throw new Error("Invalid LLM response");
  }

  const {
    scene_name,
    story_continues,
    logical_choice,
    prudent_choice,
    reckless_choice,
  } = parsed.data;

  return {
    uploadPath: "./image",
    imgFileName: toSlug(scene_name),
    imgType: "image/png",
    imgName: scene_name,
    description: story_continues,
    attributes: [
      { trait_type: "Logical Choice", value: logical_choice },
      { trait_type: "Prudent Choice", value: prudent_choice },
      { trait_type: "Reckless Choice", value: reckless_choice },
    ],
  };
}

//----------------------------------
// Image generation
//----------------------------------

async function createImage(config: NftConfig): Promise<string> {
  const prompt = `Create a watercolor-style medieval fantasy scene. Depict: ${config.description}. The protagonist wears a red metallic helmet that masks the head (gender ambiguous). No text, no explicit choices.`;

  const { data } = await oai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "auto",
    style:"vivid"
  });

  const url = data[0]?.url;
  if (!url) throw new Error("Image generation failed – missing URL");

  const { data: imgBuffer } = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
  });

  const dir = path.resolve(config.uploadPath);
  await fsAsync.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${config.imgFileName}.png`);
  await fsAsync.writeFile(filePath, Buffer.from(imgBuffer));

  logger.info("Saved image to", filePath);
  return filePath;
}

//----------------------------------
// Upload assets & metadata
//----------------------------------

async function createURI(
  imagePath: string,
  config: NftConfig
): Promise<{ imageUri: string; metadataUri: string }> {
  const imageBuffer = await fsAsync.readFile(imagePath);

  const imageFile: GenericFile = {
    buffer: imageBuffer,
    fileName: config.imgFileName,
    displayName: config.imgName,
    uniqueName: config.imgFileName,
    contentType: config.imgType,
    extension: "png",
    tags: [],
  };

  const [imageUri] = await umi.uploader.upload([imageFile]);
  if (!imageUri) throw new Error("Image upload failed");

  const metadataUri = await umi.uploader.uploadJson({
    ...config,
    imageURI: imageUri,
  });

  return { imageUri, metadataUri };
}

//----------------------------------
// Mint NFT asset
//----------------------------------

async function createAsset(
  uriConfig: UriConfig,
  metadataUri: string
): Promise<string> {
  const assetSigner = generateSigner(umi);

  const { signature } = await create(umi, {
    asset: assetSigner,
    name: uriConfig.imgName,
    uri: metadataUri,
  }).sendAndConfirm(umi);

  logger.info("Asset minted", signature);
  return assetSigner.publicKey.toString();
}

//----------------------------------
// Fetch on-chain asset data
//----------------------------------

async function fetchImageFromAsset(address: string): Promise<string> {
  const asset = await fetchAsset(umi, address, { skipDerivePlugins: false });
  const { data } = await axios.get<{ imageURI: string }>(asset.uri);
  return data.imageURI;
}

//----------------------------------
// Main orchestration
//----------------------------------

export async function main() {
  try {
    const storySoFar =
      "Toly, the knight of Solana, stood at the edge of the Enchanted Forest, his quest to save the kingdom just beginning.";

    // 1️⃣ Generate metadata config
    logger.info("Generating scene with GPT‑4o …");
    const cfg = await defineConfig(storySoFar);

    // 2️⃣ Create illustration
    logger.info("Creating illustration with DALL·E 3 …");
    const imagePath = await createImage(cfg);

    // 3️⃣ Upload files
    logger.info("Uploading image and metadata …");
    const { imageUri, metadataUri } = await createURI(imagePath, cfg);

    // 4️⃣ Mint NFT
    const uriCfg: UriConfig = { ...cfg, imageURI: imageUri };
    logger.info("Minting NFT …");
    const assetAddress = await createAsset(uriCfg, metadataUri);

    // 5️⃣ House‑keeping (delete local file)
    fs.unlink(imagePath, (e) => e && logger.error("Cleanup error", e));

    // 6️⃣ Verify (optional)
    const onChainImage = await fetchImageFromAsset(assetAddress);
    logger.info("✅ Done! On‑chain image URI:", onChainImage);
  } catch (err) {
    logger.error(err);
    process.exitCode = 1;
  }
}
if (require.main === module) {
  main();
}