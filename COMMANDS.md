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
- solana program extend <PROGRAM_ID> <ADDITIONAL_BYTES>

## Deploying PDA checklist

1. Deploy the executable program that will initialize the PDA account and derive the PDA address
2. Grab PDA address from the logs
3. Call initialize function to create the PDA account at the address -> the Assigned program ID should changed from System Program to the program previously deployed 

# Trident Fuzzing Setup and Execution

1. Install Trident CLI and honggfuzz:
   - `cargo install trident-cli`
   - `cargo install honggfuzz`

2. Initialize Trident in Your Project:
   - `trident init fuzz`

3. Write Fuzz test and customize instructions:
   - If needed, get program binaries: 
     ```
     solana program dump <PROGRAM_ID> /path/to/save/program.so
     ```
   - Place binaries into `trident-genesis` folder at the root of your project.
   - Edit `fuzz_instructions` and `test_fuzz.rs` -> learn more [here](https://www.youtube.com/watch?v=5JRVnxGW8kc) and [here](https://github.com/Ackee-Blockchain/Solana-Auditors-Bootcamp/blob/master/Lesson-3/README.md#step-1---initialize-trident)

4. Edit the `Trident.toml` file:
   - Decide how many iterations the fuzzer will perform.
   - Decide if the fuzzer needs to exit upon crash.

5. Run the Fuzz Test:
   - `trident fuzz run fuzz_0`

6. If crashes are found:
   - Run `trident fuzz run-debug fuzz_0 ./trident-tests/fuzz_tests/fuzzing/hfuzz_workspace/fuzz_0/SIGABRT_CRASH_FILE>`
