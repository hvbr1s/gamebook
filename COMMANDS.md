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
- solana-install init <solana-version>
- solana-install list
- cargo tree -p ahash (run to see the dependency tree)

## Deploying specific version of Rust
- Run `rustup install <version>`
- Run `rustup default <version>` to set that version to default.
- To see all the Rust versions installed on your system, run `rustup toolchain list`
- To uninstall a version, run `rustup toolchain uninstall`

## Deploying Contrat without Anchor

- Run `cargo build-bpf --manifest-path=./Cargo.toml`
- Grind a key for this program by running `solana-keygen new -o program-keypair-<program_name>.json`
- Run `solana program deploy ./target/deploy/your_program.so --program-id ls program-keypair-<program_name>.json`
- Grab second `program.so` files in `./target/deploy` folder.
- Grind a key for that program by running `solana-keygen new -o program-keypair-<program_name>.json`
- Repeat for each program that needs to be deployed. If you're deploying multiple programs, it's important to grind a unique key for each
- Run `solana program deploy ./target/deploy/your_program.so --program-id program-keypair.json` to deploy

To deploy the program's IDL, you'll need Shank:

- Install Shank by running: `cargo install --git https://github.com/metaplex-foundation/shank shank-cli`
- Generate IDL by running: `shank idl --out-dir idl --crate-root programs/src`

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
