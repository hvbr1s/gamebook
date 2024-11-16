use anchor_lang::prelude::*;
use crate::instructions::*;

pub mod instructions;
pub mod states;
pub mod errors;

declare_id!("BLEa4UDmpSn7URDAmmWXhg1KpTKt43Rp7bTeUgo7X3Bz");

#[program]
pub mod pda_account {
    use super::*;

    pub fn initialize_pda(ctx: Context<Initialize>, chapter_count: u8) -> Result<()> {
        instructions::initialize_pda(ctx, chapter_count)
    }
}
