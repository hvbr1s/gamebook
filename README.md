# Toly's NeverEnding Adventure

## Overview

Toly's NeverEnding Adventure is a gamebook app that is currently deployed on devnet. It's a game that combines Solana Metaplex Core assets, AI, Blinks and classic pen-and-paper gamebook mechanics to create a never-ending on-chain adventure experience on Solana,

## Demo

Test it out [here](https://dial.to/?action=solana-action%3Ahttps%3A%2F%2Fgamebook-solana.onrender.com%2Fget_action&cluster=devnet).

[![Toly's Infinite Adventure Demo](https://img.youtube.com/vi/wgEKM16DF10/0.jpg)](https://www.youtube.com/watch?v=wgEKM16DF10)

## How It Works

1. Ensure your wallet is configured to use the Solana Devnet and that you have a sufficient Devnet SOL balance. You can obtain Devnet SOL [here](https://faucet.solana.com/).
2. Choose an option to progress Toly's adventure.
3. As Toly's story unfolds, new frames of the adventure are generated.
4. Each frame is minted as a Metaplex Core NFT.
5. The NFT is sent to a newly created PDA (Program Derived Address) associated with the user.

## Self-Hosted Version  

1. Clone the repository.  
2. In the root of the project, create a `.env` file and add the following keys:  
   - `OPENAI_API_KEY` -> you can get one [here](https://openai.com/index/openai-api/)
   - `QUICKNODE_DEVNET_KEY` -> you can get one [here](https://www.quicknode.com/)
   - `MINTER_PRIVATE_KEY` (a regular Solana private key represented as an array of bytes). Ensure the `MINTER_PRIVATE_KEY` is formatted as: `"260, 12, 8, 1124, etc"` **without** the square brackets.  
3. From the root of the project, run `npm install` to install all dependencies.  
4. Once the dependencies are installed, run `npm run start` to start the local server.  
5. With the server running, visit [https://www.dial.to/](https://www.dial.to/) and paste `http://localhost:8000/get_action` to display the blink.  
6. Before progressing through the story, ensure your Solana wallet is unlocked, set to `devnet` and that the blink interface is also configured for `devnet`, there should be a button in the Blink UI that will let you switch between `Devnet` and `Mainnet`.  
7. After progressing the story, wait approximately 2 minutes before refreshing the blink to display the next step of Toly's NeverEnding journey. Enjoy!

## Testing  

1. From the root of the project, `cd` into the `/solana` directory.  
2. While in the directory, run `anchor run` to start the test suite. You can add additional tests by editing the `backend.ts` file in the `/tests` directory.
