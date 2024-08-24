## Configs and tooling

- solana config set --url localhost
- solana config set --url devnet
- solana-test-validator
- anchor test --skip-local-validator
- anchor test --skip-deploy
- anchor test --skip-deploy --skip-local-validator
- solana-keygen grind --starts-with <PREFIX>:1
- solana-test-validator --reset
- solana program close <PROGRAM_ID> --bypass-warning
- anchor idl init -f ./link/to/idl.json <PROGRAM_ID>

## Deploying PDA checklist

1. Deploy the executable program that will initialize the PDA account and derive the PDA address
2. Grab PDA address from the logs
3. Call initialize function to create the PDA account at the address -> the Assigned program ID should changed from System Program to the program previously deployed 